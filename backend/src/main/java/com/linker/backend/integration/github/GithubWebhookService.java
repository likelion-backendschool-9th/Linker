package com.linker.backend.integration.github;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.List;

import com.linker.backend.async.webhook.WebhookQueue;
import com.linker.backend.entity.github.GithubWebhookDelivery;
import com.linker.backend.entity.github.type.WebhookStatus;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.config.GithubWebhookSettings;
import com.linker.backend.repository.github.GithubWebhookDeliveryRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
public class GithubWebhookService {

	private static final Logger log = LoggerFactory.getLogger(GithubWebhookService.class);
	private static final int MAX_BODY_BYTES = 5 * 1024 * 1024;

	private final GithubWebhookSignatureVerifier signatures;
	private final GithubWebhookDeliveryRepository deliveries;
	private final WebhookQueue queue;
	private final ObjectMapper objectMapper;
	private final List<GithubWebhookHandler> handlers;
	private final GithubWebhookDispatchLock locks;
	private final GithubWebhookSettings settings;
	private final Clock clock;
	private final TransactionTemplate transactions;

	public GithubWebhookService(
			GithubWebhookSignatureVerifier signatures,
			GithubWebhookDeliveryRepository deliveries,
			WebhookQueue queue,
			ObjectMapper objectMapper,
			List<GithubWebhookHandler> handlers,
			GithubWebhookDispatchLock locks,
			GithubWebhookSettings settings,
			Clock clock,
			PlatformTransactionManager transactionManager
	) {
		this.signatures = signatures;
		this.deliveries = deliveries;
		this.queue = queue;
		this.objectMapper = objectMapper;
		this.handlers = handlers;
		this.locks = locks;
		this.settings = settings;
		this.clock = clock;
		this.transactions = new TransactionTemplate(transactionManager);
		this.transactions.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
	}

	@Transactional(propagation = Propagation.NEVER)
	public boolean accept(String deliveryId, String event, String signature, byte[] body) {
		signatures.verify(body == null ? new byte[0] : body, signature);
		validateEnvelope(deliveryId, event, body);
		JsonNode payload = readPayload(body);
		String action = text(payload, "action", 128);
		Long installationId = installationId(payload);
		String raw = new String(body, StandardCharsets.UTF_8);
		String id = deliveryId.trim();
		if (deliveries.findByDeliveryId(id).isPresent()) {
			requeueIfStillReceived(id);
			return true;
		}
		try {
			GithubWebhookDelivery saved = deliveries.saveAndFlush(GithubWebhookDelivery.received(
					id,
					event.trim(),
					action,
					installationId,
					raw
			));
			enqueue(saved.getId());
			return false;
		}
		catch (DataIntegrityViolationException exception) {
			if (deliveries.findByDeliveryId(id).isEmpty()) {
				throw exception;
			}
			requeueIfStillReceived(id);
			return true;
		}
	}

	@Transactional(propagation = Propagation.NEVER)
	public void dispatch(long id) {
		locks.withLock(id, () -> dispatchLocked(id));
	}

	private void dispatchLocked(long id) {
		GithubWebhookDelivery delivery = deliveries.findById(id).orElse(null);
		if (delivery == null || !eligible(delivery)) {
			return;
		}
		List<GithubWebhookHandler> matched = handlers.stream()
				.filter(handler -> handler.supports(delivery.getEvent()))
				.toList();
		if (matched.isEmpty()) {
			return;
		}
		try {
			for (GithubWebhookHandler handler : matched) {
				handler.handle(delivery);
			}
		}
		catch (RuntimeException exception) {
			transactions.executeWithoutResult(status -> deliveries.findByIdForUpdate(id)
					.ifPresent(saved -> saved.markFailed(clock.instant())));
			log.warn("webhook handler failed for delivery {}: {}", id, exception.getClass().getSimpleName());
			return;
		}
		transactions.executeWithoutResult(status -> deliveries.findByIdForUpdate(id)
				.ifPresent(saved -> saved.markProcessed(clock.instant())));
	}

	@Transactional(propagation = Propagation.NEVER)
	public void recover() {
		Instant now = clock.instant();
		Instant receivedBefore = now.minus(settings.receivedTimeout());
		Instant retryBefore = now.minus(settings.retryDelay());
		for (Long id : deliveries.findRecoveryIds(receivedBefore, retryBefore, settings.maxAttempts(), settings.recoveryBatchSize())) {
			Integer touched = transactions.execute(status -> deliveries.touchForRecovery(
					id, now, receivedBefore, retryBefore, settings.maxAttempts()));
			if (touched != null && touched == 1) {
				enqueue(id);
			}
		}
	}

	private boolean eligible(GithubWebhookDelivery delivery) {
		return delivery.getStatus() == WebhookStatus.RECEIVED
				|| (delivery.getStatus() == WebhookStatus.FAILED
				&& delivery.getAttempts() < settings.maxAttempts()
				&& delivery.getProcessedAt() != null
				&& !delivery.getProcessedAt().isAfter(clock.instant().minus(settings.retryDelay())));
	}

	private void requeueIfStillReceived(String deliveryId) {
		deliveries.findByDeliveryId(deliveryId)
				.filter(delivery -> delivery.getStatus() == WebhookStatus.RECEIVED)
				.ifPresent(delivery -> enqueue(delivery.getId()));
	}

	private void enqueue(long deliveryRowId) {
		try {
			queue.enqueue(deliveryRowId);
		}
		catch (RuntimeException exception) {
			log.warn("webhook enqueue failed: {}", exception.getClass().getSimpleName());
			throw new ApiException(503, "SERVICE_UNAVAILABLE", "잠시 후 다시 시도해 주세요");
		}
	}

	private void validateEnvelope(String deliveryId, String event, byte[] body) {
		if (body == null || body.length == 0 || body.length > MAX_BODY_BYTES) {
			throw new ApiException(400, "VALIDATION_ERROR", "웹훅 본문을 확인해 주세요");
		}
		if (!printable(deliveryId, 255) || !printable(event, 64)) {
			throw new ApiException(400, "VALIDATION_ERROR", "웹훅 헤더를 확인해 주세요");
		}
	}

	private JsonNode readPayload(byte[] body) {
		try {
			JsonNode node = objectMapper.readTree(body);
			if (node == null || !node.isObject()) {
				throw new ApiException(400, "VALIDATION_ERROR", "웹훅 본문을 확인해 주세요");
			}
			return node;
		}
		catch (ApiException exception) {
			throw exception;
		}
		catch (RuntimeException exception) {
			throw new ApiException(400, "VALIDATION_ERROR", "웹훅 본문을 확인해 주세요");
		}
	}

	private String text(JsonNode payload, String field, int max) {
		JsonNode node = payload.get(field);
		if (node == null || !node.isString()) {
			return null;
		}
		String value = node.stringValue();
		return value.length() <= max ? value : value.substring(0, max);
	}

	private Long installationId(JsonNode payload) {
		JsonNode installation = payload.get("installation");
		if (installation == null || !installation.isObject()) {
			return null;
		}
		JsonNode id = installation.get("id");
		if (id == null || !id.isIntegralNumber()) {
			return null;
		}
		return id.longValue();
	}

	private boolean printable(String value, int max) {
		if (value == null) {
			return false;
		}
		String trimmed = value.trim();
		if (trimmed.isEmpty() || trimmed.length() > max) {
			return false;
		}
		for (int i = 0; i < trimmed.length(); i++) {
			char ch = trimmed.charAt(i);
			if (ch < 33 || ch > 126) {
				return false;
			}
		}
		return true;
	}
}
