package com.linker.backend.entity.github;

import java.time.Instant;

import com.linker.backend.entity.github.type.WebhookStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "github_webhook_deliveries")
public class GithubWebhookDelivery {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true, length = 255)
	private String deliveryId;

	@Column(nullable = false, length = 64)
	private String event;

	@Column(length = 128)
	private String action;

	private Long installationId;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(nullable = false, columnDefinition = "jsonb")
	private String payload;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private WebhookStatus status;

	@Column(nullable = false)
	private int attempts;

	private String error;

	private Instant processedAt;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected GithubWebhookDelivery() {
	}

	public static GithubWebhookDelivery received(
			String deliveryId,
			String event,
			String action,
			Long installationId,
			String payload
	) {
		GithubWebhookDelivery delivery = new GithubWebhookDelivery();
		delivery.deliveryId = deliveryId;
		delivery.event = event;
		delivery.action = action;
		delivery.installationId = installationId;
		delivery.payload = payload;
		delivery.status = WebhookStatus.RECEIVED;
		delivery.attempts = 0;
		return delivery;
	}

	public void markProcessed(Instant when) {
		this.status = WebhookStatus.PROCESSED;
		this.processedAt = when;
		this.error = null;
	}

	public void markFailed(Instant when) {
		this.status = WebhookStatus.FAILED;
		this.processedAt = when;
		this.attempts = this.attempts + 1;
		this.error = "HANDLER_FAILED";
	}

	public Long getId() {
		return id;
	}

	public String getDeliveryId() {
		return deliveryId;
	}

	public String getEvent() {
		return event;
	}

	public WebhookStatus getStatus() {
		return status;
	}

	public Long getInstallationId() {
		return installationId;
	}

	public String getAction() {
		return action;
	}

	public String getPayload() {
		return payload;
	}

	public int getAttempts() {
		return attempts;
	}

	public String getError() {
		return error;
	}

	public Instant getProcessedAt() {
		return processedAt;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
