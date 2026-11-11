package com.linker.backend.service.recruiter;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

import com.linker.backend.dto.chat.event.ChatRoomsChanged;
import com.linker.backend.dto.chat.request.StartRecruiterChatRequest;
import com.linker.backend.dto.chat.response.RecruiterOfferResponses.Developer;
import com.linker.backend.dto.chat.response.RecruiterOfferResponses.FirstMessage;
import com.linker.backend.dto.chat.response.RecruiterOfferResponses.LatestOffer;
import com.linker.backend.dto.chat.response.RecruiterOfferResponses.OfferCounts;
import com.linker.backend.dto.chat.response.RecruiterOfferResponses.OfferItem;
import com.linker.backend.dto.chat.response.RecruiterOfferResponses.OfferList;
import com.linker.backend.dto.chat.response.RecruiterOfferResponses.OfferSummary;
import com.linker.backend.dto.chat.response.StartDirectChatResponse;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.time.DatabaseInstant;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.chat.ChatRoomRepository;
import com.linker.backend.repository.chat.ChatRoomRepositoryCustom.OfferMessage;
import com.linker.backend.repository.chat.ChatRoomRepositoryCustom.OfferRow;
import com.linker.backend.repository.moderation.UserBlockRepository;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Paired entry for recruiter offer reads and opening a 1:1 room from a profile. */
@Service("recruiterChatService")
public class ChatService {

	private final ChatRoomRepository rooms;
	private final ChatRoomMemberRepository members;
	private final UserRepository accounts;
	private final UserBlockRepository blocks;
	private final ApplicationEventPublisher events;
	private final Clock clock;

	public ChatService(
			ChatRoomRepository rooms,
			ChatRoomMemberRepository members,
			UserRepository accounts,
			UserBlockRepository blocks,
			ApplicationEventPublisher events,
			Clock clock
	) {
		this.rooms = rooms;
		this.members = members;
		this.accounts = accounts;
		this.blocks = blocks;
		this.events = events;
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
				rooms.countRecruitingOffersSince(principal.userId(), start),
				PlanLimits.RECRUITING_OFFERS_PER_DAY_FREE,
				PlanLimits.RECRUITING_OFFERS_PER_DAY_SCOUT,
				false,
				latest);
	}

	@Transactional(readOnly = true)
	public FirstMessage firstMessage(AuthenticatedUser principal, long roomId) {
		OfferMessage message = rooms.firstOfferMessage(principal.userId(), roomId);
		if (message == null) {
			throw new ApiException(404, "NOT_FOUND", "채용 제안을 찾을 수 없어요");
		}
		return new FirstMessage(roomId, message.body() == null ? "" : message.body(), message.sentAt());
	}

	/**
	 * Opens a 1:1 room with a developer. An existing pair is reused and accepted so the recruiter can enter it.
	 */
	@Transactional
	public StartDirectChatResponse openChat(AuthenticatedUser principal, StartRecruiterChatRequest request) {
		User me = requireRecruiter(principal);
		if (request == null || request.userId() == null || request.userId() < 1) {
			throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		}
		long targetId = request.userId();
		if (targetId == me.getId()) {
			throw new ApiException(400, "VALIDATION_ERROR", "나에게는 메시지를 보낼 수 없어요");
		}
		User target = accounts.findById(targetId)
				.filter(user -> user.getUserType() == UserType.DEVELOPER)
				.filter(user -> user.getDeletedAt() == null
						&& user.getStatus() != UserStatus.DELETED && user.getStatus() != UserStatus.WITHDRAWING)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));
		if (blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(me.getId(), target.getId())
				|| blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(target.getId(), me.getId())) {
			throw new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요");
		}
		String dmKey = Math.min(me.getId(), targetId) + ":" + Math.max(me.getId(), targetId);
		Instant now = DatabaseInstant.now(clock);
		rooms.insertAcceptedIfAbsent(dmKey, me.getId(), now);
		ChatRoom room = rooms.lockByDmKey(dmKey).orElseThrow();
		room.openRecruiting(me.getId(), now);
		boolean changed = ensureMember(room, me.getId());
		changed |= ensureMember(room, targetId);
		if (changed) {
			events.publishEvent(new ChatRoomsChanged(me.getId(), room.getId()));
			events.publishEvent(new ChatRoomsChanged(targetId, room.getId()));
		}
		return StartDirectChatResponse.direct(room.getId());
	}

	private User requireRecruiter(AuthenticatedUser principal) {
		if (principal == null) {
			throw new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요");
		}
		User account = accounts.findById(principal.userId())
				.filter(user -> user.getUserType() == UserType.RECRUITER)
				.orElseThrow(() -> new ApiException(403, "FORBIDDEN", "이 기능을 사용할 수 없어요"));
		if (account.getStatus() == UserStatus.SUSPENDED) {
			throw new ApiException(403, "SUSPENDED", "정지된 계정은 이 기능을 쓸 수 없어요");
		}
		if (account.getStatus() != UserStatus.ACTIVE || account.getDeletedAt() != null) {
			throw new ApiException(403, "FORBIDDEN", "이 기능을 사용할 수 없어요");
		}
		return account;
	}

	private boolean ensureMember(ChatRoom room, long userId) {
		ChatRoomMember member = members.findAnyInRoom(room.getId(), userId).orElse(null);
		if (member == null) {
			members.saveAndFlush(ChatRoomMember.join(room, userId));
			return true;
		}
		if (member.getLeftAt() != null || member.getHiddenAt() != null) {
			member.rejoin();
			return true;
		}
		return false;
	}

	private List<OfferRow> rows(AuthenticatedUser principal) {
		if (principal == null) {
			throw new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요");
		}
		return rooms.recruitingOffers(principal.userId());
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
