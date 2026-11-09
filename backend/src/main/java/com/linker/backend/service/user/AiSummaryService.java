package com.linker.backend.service.user;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.stream.Collectors;

import com.linker.backend.dto.chat.response.AiChatSummaryResponse;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.chat.AiChatSummary;
import com.linker.backend.entity.chat.ChatMessage;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.entity.chat.type.AiSummaryStatus;
import com.linker.backend.entity.chat.type.RoomType;
import com.linker.backend.entity.team.Team;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.ai.LlmClient;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.chat.AiChatSummaryRepository;
import com.linker.backend.repository.chat.ChatMessageRepository;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.subscription.SubscriptionRepository;
import com.linker.backend.repository.team.TeamRepository;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service("userAiSummaryService")
public class AiSummaryService {

	public static final String DISCLAIMER = "AI가 만든 요약이라 틀릴 수 있어요";

	private static final ZoneId KST = PlanLimits.APP_ZONE;

	private final ChatRoomMemberRepository members;
	private final ChatMessageRepository messages;
	private final TeamRepository teams;
	private final SubscriptionRepository subscriptions;
	private final UserRepository accounts;
	private final AiChatSummaryRepository summaries;
	private final LlmClient llm;
	private final StringRedisTemplate redis;
	private final Clock clock;
	private final TransactionTemplate transactions;
	private final ExecutorService workers = Executors.newCachedThreadPool(r -> {
		Thread thread = new Thread(r, "ai-summary");
		thread.setDaemon(true);
		return thread;
	});

	public AiSummaryService(
			ChatRoomMemberRepository members,
			ChatMessageRepository messages,
			TeamRepository teams,
			SubscriptionRepository subscriptions,
			UserRepository accounts,
			AiChatSummaryRepository summaries,
			LlmClient llm,
			StringRedisTemplate redis,
			Clock clock,
			PlatformTransactionManager tx
	) {
		this.members = members;
		this.messages = messages;
		this.teams = teams;
		this.subscriptions = subscriptions;
		this.accounts = accounts;
		this.summaries = summaries;
		this.llm = llm;
		this.redis = redis;
		this.clock = clock;
		this.transactions = new TransactionTemplate(tx);
	}

	public record CreateResult(AiChatSummaryResponse body, boolean accepted) {
	}

	public CreateResult create(AuthenticatedUser user, long roomId) {
		Prepared prepared = transactions.execute(status -> prepare(user, roomId));
		if (prepared == null) {
			throw new ApiException(500, "FORBIDDEN", "요약을 시작하지 못했어요");
		}
		Future<String> future = workers.submit(() -> summarizeWithRetry(prepared.prompt()));
		try {
			String text = future.get(PlanLimits.AI_SUMMARY_SYNC_SECONDS, TimeUnit.SECONDS);
			AiChatSummaryResponse body = transactions.execute(status -> {
				AiChatSummary row = summaries.findById(prepared.summaryId())
						.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "요약을 찾지 못했어요"));
				row.complete(text);
				summaries.save(row);
				return toResponse(row, prepared.usedToday());
			});
			return new CreateResult(body, false);
		}
		catch (TimeoutException timeout) {
			workers.execute(() -> finishAsync(prepared.summaryId(), future, prepared.userId()));
			AiChatSummaryResponse body = transactions.execute(status -> {
				AiChatSummary row = summaries.findById(prepared.summaryId())
						.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "요약을 찾지 못했어요"));
				return toResponse(row, prepared.usedToday());
			});
			return new CreateResult(body, true);
		}
		catch (Exception failed) {
			future.cancel(true);
			AiChatSummaryResponse body = transactions.execute(status -> {
				AiChatSummary row = summaries.findById(prepared.summaryId())
						.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "요약을 찾지 못했어요"));
				row.fail();
				summaries.save(row);
				refundDaily(prepared.userId());
				return toResponse(row, Math.max(0, prepared.usedToday() - 1));
			});
			return new CreateResult(body, false);
		}
	}

	@Transactional(readOnly = true)
	public AiChatSummaryResponse get(AuthenticatedUser user, long roomId, long summaryId) {
		requireTeamRoom(user, roomId);
		AiChatSummary row = summaries.findOwn(summaryId, roomId, user.userId())
				.filter(found -> found.getExpiresAt().isAfter(clock.instant()))
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "요약을 찾지 못했어요"));
		return toResponse(row, usedToday(user.userId()));
	}

	private Prepared prepare(AuthenticatedUser user, long roomId) {
		ChatRoom room = requireTeamRoom(user, roomId);
		long teamId = room.getTeamId();
		Team team = teams.findById(teamId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "채팅방을 찾지 못했어요"));
		if (!subscriptions.hasFlexBenefit(teamId, clock.instant())) {
			throw new ApiException(
					403,
					"PLAN_LIMIT",
					"Flex 구독 팀만 쓸 수 있어요. 오너에게 Flex를 요청해 보세요.",
					Map.of("reason", "AI_SUMMARY"));
		}
		if (!team.isAiSummaryEnabled()) {
			throw new ApiException(403, "FORBIDDEN", "이 팀은 AI 요약을 쓰지 않아요");
		}

		int used = reserveDaily(user.userId());
		List<ChatMessage> batch = messages.findForAiSummary(
				roomId,
				user.userId(),
				PageRequest.of(0, PlanLimits.AI_SUMMARY_MAX_MESSAGES));
		if (batch.size() < PlanLimits.AI_SUMMARY_MIN_MESSAGES) {
			refundDaily(user.userId());
			throw new ApiException(400, "VALIDATION_ERROR", "직접 읽는 게 더 빨라요");
		}
		List<ChatMessage> chronological = new ArrayList<>(batch);
		Collections.reverse(chronological);
		AiChatSummary row = summaries.save(AiChatSummary.pending(
				roomId,
				user.userId(),
				chronological.size(),
				chronological.getFirst().getId(),
				chronological.getLast().getId(),
				llm.modelName(),
				clock.instant().plus(Duration.ofDays(PlanLimits.AI_SUMMARY_RETENTION_DAYS))
		));
		return new Prepared(row.getId(), user.userId(), used, buildPrompt(chronological));
	}

	private void finishAsync(long summaryId, Future<String> future, long requesterId) {
		try {
			String text = future.get(PlanLimits.AI_SUMMARY_ASYNC_SECONDS, TimeUnit.SECONDS);
			transactions.executeWithoutResult(status -> {
				AiChatSummary row = summaries.findById(summaryId).orElse(null);
				if (row == null || row.getStatus() != AiSummaryStatus.PENDING) {
					return;
				}
				row.complete(text);
				summaries.save(row);
			});
		}
		catch (Exception failed) {
			future.cancel(true);
			transactions.executeWithoutResult(status -> {
				AiChatSummary row = summaries.findById(summaryId).orElse(null);
				if (row == null || row.getStatus() != AiSummaryStatus.PENDING) {
					return;
				}
				row.fail();
				summaries.save(row);
			});
			refundDaily(requesterId);
		}
	}

	private ChatRoom requireTeamRoom(AuthenticatedUser user, long roomId) {
		if (user == null) {
			throw new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요");
		}
		ChatRoomMember membership = members.findActive(roomId, user.userId())
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "채팅방을 찾지 못했어요"));
		ChatRoom room = membership.getRoom();
		if (room.getRoomType() != RoomType.TEAM || room.getTeamId() == null) {
			throw new ApiException(403, "FORBIDDEN", "팀 채팅에서만 요약할 수 있어요");
		}
		return room;
	}

	/** Policy: one retry, then FAILED. */
	private String summarizeWithRetry(String prompt) {
		try {
			return llm.summarizeChat(prompt);
		}
		catch (RuntimeException first) {
			return llm.summarizeChat(prompt);
		}
	}

	private String buildPrompt(List<ChatMessage> chronological) {
		List<Long> senderIds = chronological.stream()
				.map(ChatMessage::getSenderId)
				.filter(Objects::nonNull)
				.distinct()
				.toList();
		Map<Long, String> names = accounts.findAllById(senderIds).stream()
				.collect(Collectors.toMap(User::getId, this::label));
		StringBuilder builder = new StringBuilder("다음 팀 채팅을 한국어로 한 단락 요약해 주세요.\n\n");
		for (ChatMessage message : chronological) {
			String who = message.getSenderId() == null
					? "시스템"
					: names.getOrDefault(message.getSenderId(), "멤버");
			String body = message.getBody() == null ? "" : message.getBody().strip();
			if (body.isBlank()) {
				continue;
			}
			builder.append(who).append(": ").append(body).append('\n');
		}
		return builder.toString();
	}

	private String label(User account) {
		if (account.getDisplayName() != null && !account.getDisplayName().isBlank()) {
			return account.getDisplayName();
		}
		return account.getUsername();
	}

	private AiChatSummaryResponse toResponse(AiChatSummary row, int usedToday) {
		return new AiChatSummaryResponse(
				row.getId(),
				row.getStatus().name(),
				row.getStatus() == AiSummaryStatus.DONE ? row.getSummaryLine() : null,
				row.getMessageCount(),
				usedToday,
				PlanLimits.AI_SUMMARY_PER_DAY_FLEX,
				DISCLAIMER
		);
	}

	private record Prepared(long summaryId, long userId, int usedToday, String prompt) {
	}

	private int reserveDaily(long userId) {
		String key = dailyKey(userId);
		Long count = redis.opsForValue().increment(key);
		if (count == null) {
			throw new ApiException(500, "FORBIDDEN", "잠시 후 다시 시도해 주세요");
		}
		if (count == 1) {
			redis.expire(key, ttlUntilMidnight());
		}
		if (count > PlanLimits.AI_SUMMARY_PER_DAY_FLEX) {
			redis.opsForValue().decrement(key);
			throw new ApiException(
					429,
					"RATE_LIMITED",
					"오늘은 AI 요약을 다 썼어요(" + PlanLimits.AI_SUMMARY_PER_DAY_FLEX + "/"
							+ PlanLimits.AI_SUMMARY_PER_DAY_FLEX + "). 내일 다시 쓸 수 있어요.");
		}
		return count.intValue();
	}

	private void refundDaily(long userId) {
		String key = dailyKey(userId);
		Long value = redis.opsForValue().decrement(key);
		if (value != null && value < 0) {
			redis.delete(key);
		}
	}

	private int usedToday(long userId) {
		String raw = redis.opsForValue().get(dailyKey(userId));
		if (raw == null) {
			return 0;
		}
		try {
			return Math.max(0, Integer.parseInt(raw));
		}
		catch (NumberFormatException ignored) {
			return 0;
		}
	}

	private String dailyKey(long userId) {
		LocalDate day = LocalDate.now(clock.withZone(KST));
		return "ai-summary:" + userId + ":" + day;
	}

	private Duration ttlUntilMidnight() {
		Instant now = clock.instant();
		Instant next = LocalDate.now(clock.withZone(KST)).plusDays(1).atStartOfDay(KST).toInstant();
		long seconds = Math.max(1, Duration.between(now, next).getSeconds());
		return Duration.ofSeconds(seconds);
	}
}
