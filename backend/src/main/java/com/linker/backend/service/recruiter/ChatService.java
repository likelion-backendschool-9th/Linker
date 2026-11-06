package com.linker.backend.service.recruiter;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

import com.linker.backend.dto.chat.response.RecruiterOfferResponses.Developer;
import com.linker.backend.dto.chat.response.RecruiterOfferResponses.FirstMessage;
import com.linker.backend.dto.chat.response.RecruiterOfferResponses.LatestOffer;
import com.linker.backend.dto.chat.response.RecruiterOfferResponses.OfferCounts;
import com.linker.backend.dto.chat.response.RecruiterOfferResponses.OfferItem;
import com.linker.backend.dto.chat.response.RecruiterOfferResponses.OfferList;
import com.linker.backend.dto.chat.response.RecruiterOfferResponses.OfferSummary;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.chat.RecruitingOfferQuery;
import com.linker.backend.repository.chat.RecruitingOfferQuery.OfferMessage;
import com.linker.backend.repository.chat.RecruitingOfferQuery.OfferRow;
import com.linker.backend.repository.moderation.UserBlockRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Paired entry for recruiter offer reads. Page 17 owns creating the request. */
@Service("recruiterChatService")
public class ChatService {

	private final RecruitingOfferQuery offers;
	private final UserBlockRepository blocks;
	private final Clock clock;

	public ChatService(RecruitingOfferQuery offers, UserBlockRepository blocks, Clock clock) {
		this.offers = offers;
		this.blocks = blocks;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public OfferList list(AuthenticatedUser principal, String status) {
		String filter = status == null || status.isBlank() ? null : status.trim();
		if (filter != null && !filter.equals("TALKING") && !filter.equals("WAITING") && !filter.equals("NO_RESPONSE")) {
			throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		}
		Instant now = Instant.now(clock);
		List<OfferItem> items = rows(principal).stream()
				.map(row -> item(principal.userId(), row, now))
				.filter(item -> filter == null || filter.equals(item.status()))
				.toList();
		return new OfferList(items, null);
	}

	@Transactional(readOnly = true)
	public OfferCounts counts(AuthenticatedUser principal) {
		Instant now = Instant.now(clock);
		int talking = 0;
		int waiting = 0;
		int silent = 0;
		for (OfferRow row : rows(principal)) {
			switch (status(row, now)) {
				case "TALKING" -> talking++;
				case "WAITING" -> waiting++;
				default -> silent++;
			}
		}
		return new OfferCounts(talking, waiting, silent);
	}

	@Transactional(readOnly = true)
	public OfferSummary summary(AuthenticatedUser principal) {
		Instant now = Instant.now(clock);
		List<OfferItem> items = rows(principal).stream().map(row -> item(principal.userId(), row, now)).toList();
		int talking = (int) items.stream().filter(item -> "TALKING".equals(item.status())).count();
		int waiting = (int) items.stream().filter(item -> "WAITING".equals(item.status())).count();
		LocalDate today = LocalDate.ofInstant(now, PlanLimits.APP_ZONE);
		Instant start = today.atStartOfDay(PlanLimits.APP_ZONE).toInstant();
		List<LatestOffer> latest = items.stream().limit(3)
				.map(item -> new LatestOffer(item.roomId(), item.developer(), item.status(), item.sentAt()))
				.toList();
		return new OfferSummary(
				talking,
				waiting,
				offers.sentSince(principal.userId(), start),
				PlanLimits.RECRUITING_OFFERS_PER_DAY_FREE,
				PlanLimits.RECRUITING_OFFERS_PER_DAY_SCOUT,
				false,
				latest);
	}

	@Transactional(readOnly = true)
	public FirstMessage firstMessage(AuthenticatedUser principal, long roomId) {
		OfferMessage message = offers.firstMessage(principal.userId(), roomId);
		if (message == null) {
			throw new ApiException(404, "NOT_FOUND", "채용 제안을 찾을 수 없어요");
		}
		return new FirstMessage(roomId, message.body() == null ? "" : message.body(), message.sentAt());
	}

	private List<OfferRow> rows(AuthenticatedUser principal) {
		if (principal == null) {
			throw new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요");
		}
		return offers.list(principal.userId());
	}

	private OfferItem item(long recruiterId, OfferRow row, Instant now) {
		boolean unavailable = row.developerId() == null
				|| row.developerDeletedAt() != null
				|| "DELETED".equals(row.developerStatus())
				|| "WITHDRAWING".equals(row.developerStatus())
				|| blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(recruiterId, row.developerId())
				|| blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(row.developerId(), recruiterId);
		Developer developer = unavailable ? null : new Developer(
				row.developerId(),
				row.username(),
				row.displayName() == null || row.displayName().isBlank() ? row.username() : row.displayName(),
				row.avatarUrl(),
				"DEVELOPER",
				jobStatus(row.jobSeekingStatus()));
		return new OfferItem(
				row.roomId(),
				status(row, now),
				developer,
				unavailable,
				unavailable ? List.of() : row.techStack(),
				row.firstBody() == null ? "" : row.firstBody(),
				row.firstAt() == null ? row.createdAt() : row.firstAt());
	}

	private static String status(OfferRow row, Instant now) {
		Instant created = row.createdAt() == null ? now : row.createdAt();
		return switch (row.dmStatus() == null ? "" : row.dmStatus()) {
			case "ACCEPTED" -> "TALKING";
			case "REJECTED" -> hiddenUntil(row.respondedAt() == null ? created : row.respondedAt(), now) ? "WAITING" : "NO_RESPONSE";
			case "EXPIRED" -> "NO_RESPONSE";
			default -> {
				Instant deadline = row.requestExpiresAt() == null
						? created.plus(PlanLimits.RECRUITING_OFFER_REPLY_DAYS, ChronoUnit.DAYS)
						: row.requestExpiresAt();
				yield deadline.isAfter(now) ? "WAITING" : "NO_RESPONSE";
			}
		};
	}

	private static boolean hiddenUntil(Instant from, Instant now) {
		return from.plus(PlanLimits.RECRUITING_OFFER_REPLY_DAYS, ChronoUnit.DAYS).isAfter(now);
	}

	private static String jobStatus(String stored) {
		return switch (stored == null ? "" : stored) {
			case "OPEN" -> "SEEKING";
			case "OFFERS_ONLY" -> "OPEN";
			default -> "OFF";
		};
	}

}
