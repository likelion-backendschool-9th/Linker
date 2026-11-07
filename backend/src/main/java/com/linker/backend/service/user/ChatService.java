package com.linker.backend.service.user;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.linker.backend.dto.chat.event.ChatMessageReady;
import com.linker.backend.dto.chat.event.ChatReadAdvanced;
import com.linker.backend.dto.chat.event.ChatRoomsChanged;
import com.linker.backend.dto.chat.event.ChatSendAccepted;
import com.linker.backend.dto.chat.event.ChatSendRejected;
import com.linker.backend.dto.chat.event.ChatTranscriptChanged;
import com.linker.backend.dto.chat.request.EditChatMessageRequest;
import com.linker.backend.dto.chat.request.MarkChatReadRequest;
import com.linker.backend.dto.chat.request.UpdateChatNotificationRequest;
import com.linker.backend.dto.chat.request.ShareChatCardRequest;
import com.linker.backend.dto.chat.request.StartDirectChatRequest;
import com.linker.backend.dto.chat.response.StartDirectChatResponse;
import com.linker.backend.dto.chat.response.AcceptChatRequestResponse;
import com.linker.backend.dto.chat.response.ChatCounterpartResponse;
import com.linker.backend.dto.chat.response.ChatHistoryLimitResponse;
import com.linker.backend.dto.chat.response.ChatLastMessageResponse;
import com.linker.backend.dto.chat.response.ChatMemberResponse;
import com.linker.backend.dto.chat.response.ChatMentionCandidatesResponse;
import com.linker.backend.dto.chat.response.ChatMessagePageResponse;
import com.linker.backend.dto.chat.response.ChatMessageResponse;
import com.linker.backend.dto.chat.response.ChatRoomInfoResponse;
import com.linker.backend.dto.chat.response.ChatRoomItemResponse;
import com.linker.backend.dto.chat.response.ChatRoomPageResponse;
import com.linker.backend.dto.chat.response.UnreadMembersResponse;
import com.linker.backend.dto.chat.response.UnreadSummaryResponse;
import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.chat.ChatMessage;
import com.linker.backend.entity.chat.ChatMessageImage;
import com.linker.backend.entity.chat.ChatMessageMention;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.entity.chat.type.DmStatus;
import com.linker.backend.entity.chat.type.MessageType;
import com.linker.backend.entity.chat.type.MessageVisibility;
import com.linker.backend.entity.chat.type.RoomType;
import com.linker.backend.entity.file.type.UploadPurpose;
import com.linker.backend.entity.file.UploadedFile;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.time.DatabaseInstant;
import com.linker.backend.global.realtime.ChatRoomAccess;
import com.linker.backend.global.realtime.StompAuthException;
import com.linker.backend.global.realtime.TeamChatAccess;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.RedisRateLimiter;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.chat.ChatRoomRepositoryCustom.ChatListRow;
import com.linker.backend.repository.chat.ChatRoomRepositoryCustom.ChatListSummary;
import com.linker.backend.repository.chat.ChatMessageImageRepository;
import com.linker.backend.repository.chat.ChatMessageMentionRepository;
import com.linker.backend.repository.chat.ChatMessageRepositoryCustom.ChatMessageRow;
import com.linker.backend.repository.chat.ChatMessageRepository;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.chat.ChatRoomRepository;
import com.linker.backend.repository.profile.FollowRepository;
import com.linker.backend.repository.team.TeamMemberRepository;
import com.linker.backend.entity.notification.type.NotificationTypes;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Paired entry for {@link com.linker.backend.controller.user.ChatController}.
 * Page 16 reads chat rows. Page 17 stores DIRECT text and chat images, opens DIRECT and request rooms,
 * and handles the caller's own edit, delete, read, and mute.
 * Team room info and deleting someone else's message stay closed until a real team role source exists.
 */
@Service("userChatService")
public class ChatService {

	/** Technical page size, not a Policy limit. */
	static final int PAGE_SIZE = 20;

	/** Technical history page, distinct from {@link PlanLimits#CHAT_CATCH_UP_MAX}. */
	static final int MESSAGE_PAGE_SIZE = 30;

	private static final String CHAT_SEND_BUCKET = "chat.send";
	/** Technical bound on the mention id list, not a Policy limit. The text itself is capped at 2,000 chars. */
	private static final int MAX_MENTIONED_IDS = 100;
	private static final String FREE_HISTORY = "FREE_60_DAYS";

	/** Context binding only. The token is not an authenticator or an integrity seal. */
	private static final int CURSOR_VERSION = 1;
	private static final int MAX_CURSOR_LENGTH = 160;

	static final String DELETED_PREVIEW = "삭제된 메시지입니다";
	static final String HIDDEN_PREVIEW = "운영 정책에 따라 숨겨진 메시지예요";

	private final ChatRoomAccess chatRooms;
	private final ChatRoomRepository rooms;
	private final ChatRoomMemberRepository members;
	private final ApplicationEventPublisher events;
	private final Clock clock;
	private final UserRepository accounts;
	private final ChatMessageRepository messages;
	private final RedisRateLimiter rateLimiter;
	private final TransactionTemplate transactions;
	private final ModerationService moderation;
	private final UploadService uploads;
	private final ChatMessageImageRepository imageLinks;
	private final NotificationService notifications;
	private final JsonMapper json = JsonMapper.builder().build();
	private final TeamChatAccess teamChat;
	private final ChatMessageMentionRepository mentions;
	private final FollowRepository follows;
	private final TeamMemberRepository teamMembers;

	public ChatService(
			ChatRoomAccess chatRooms,
			ChatRoomRepository rooms,
			ChatRoomMemberRepository members,
			ApplicationEventPublisher events,
			Clock clock,
			UserRepository accounts,
			ChatMessageRepository messages,
			RedisRateLimiter rateLimiter,
			PlatformTransactionManager transactions,
			ModerationService moderation,
			UploadService uploads,
			ChatMessageImageRepository imageLinks,
			NotificationService notifications,
			TeamChatAccess teamChat,
			ChatMessageMentionRepository mentions,
			FollowRepository follows,
			TeamMemberRepository teamMembers
	) {
		this.chatRooms = chatRooms;
		this.rooms = rooms;
		this.members = members;
		this.events = events;
		this.clock = clock;
		this.accounts = accounts;
		this.messages = messages;
		this.rateLimiter = rateLimiter;
		this.transactions = new TransactionTemplate(transactions);
		this.moderation = moderation;
		this.uploads = uploads;
		this.imageLinks = imageLinks;
		this.notifications = notifications;
		this.teamChat = teamChat;
		this.mentions = mentions;
		this.follows = follows;
		this.teamMembers = teamMembers;
	}

	public void sendMessage(long userId, long roomId, Map<String, Object> payload) {
		if (!chatRooms.canSend(userId, roomId)) {
			throw new StompAuthException("채팅방에 참여할 수 없어요");
		}
		SendCommand command = sendCommand(payload);
		if (!command.mentionedUserIds().isEmpty()
				&& rooms.findById(roomId).map(ChatRoom::getRoomType).orElse(null) != RoomType.TEAM) {
			throw new StompAuthException("텍스트 메시지만 보낼 수 있어요");
		}
		User account = accounts.findById(userId).orElseThrow(() -> new StompAuthException("로그인이 필요해요"));
		if (account.getStatus() != UserStatus.ACTIVE) {
			transactions.executeWithoutResult(status -> reject(
					userId,
					roomId,
					command.clientMessageId(),
					account.getStatus() == UserStatus.SUSPENDED ? "SUSPENDED" : "FORBIDDEN",
					account.getStatus() == UserStatus.SUSPENDED
							? "정지된 계정은 이 기능을 쓸 수 없어요" : "이 기능을 사용할 수 없어요",
					false,
					null
			));
			return;
		}
		try {
			Boolean stored = transactions.execute(status -> storeNewText(account, roomId, command));
			if (Boolean.TRUE.equals(stored)) {
				return;
			}
		}
		catch (DataIntegrityViolationException exception) {
			transactions.executeWithoutResult(status -> confirmStored(userId, roomId, command));
		}
	}

	@Transactional(readOnly = true)
	public ChatRoomPageResponse list(AuthenticatedUser user, String rawTab, String rawCursor) {
		String tab = resolveTab(user, rawTab);
		Instant now = clock.instant();
		Cursor cursor = decodeCursor(user.userId(), tab, rawCursor, now);
		List<ChatListRow> rows = rooms.listPage(
				user.userId(),
				tab,
				now,
				cursor == null ? null : cursor.sortAt(),
				cursor == null ? null : cursor.roomId(),
				PAGE_SIZE + 1
		);
		boolean more = rows.size() > PAGE_SIZE;
		List<ChatListRow> page = more ? rows.subList(0, PAGE_SIZE) : rows;
		String next = null;
		if (more) {
			ChatListRow last = page.get(page.size() - 1);
			next = encodeCursor(user.userId(), tab, last.sortAt(), last.roomId());
		}
		return new ChatRoomPageResponse(page.stream().map(row -> toItem(tab, row)).toList(), next);
	}

	@Transactional(readOnly = true)
	public ChatRoomInfoResponse room(AuthenticatedUser user, long roomId) {
		ChatRoomMember membership = members.findActive(roomId, user.userId())
				.filter(member -> member.getHiddenAt() == null)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "채팅방을 찾지 못했어요"));
		ChatRoom room = membership.getRoom();
		if (room.getRoomType() == RoomType.TEAM) {
			if (room.getTeamId() == null) {
				throw new ApiException(404, "NOT_FOUND", "채팅방을 찾지 못했어요");
			}
			TeamChatAccess.TeamView team = teamChat.readableBy(user.userId(), room.getTeamId());
			if (team == null) {
				throw new ApiException(404, "NOT_FOUND", "채팅방을 찾지 못했어요");
			}
			List<ChatMemberResponse> people = members.findActiveInRoom(roomId).stream()
					.map(member -> accounts.findById(member.getUserId()).orElse(null))
					.filter(Objects::nonNull)
					.map(ChatService::memberView)
					.toList();
			return new ChatRoomInfoResponse(room.getId(), "TEAM", team.name(), null, membership.isMuted(), people,
					Map.of("id", team.id(), "status", team.status()), PlanLimits.TEAM_CHAT_HISTORY_DAYS_FREE);
		}
		String kind;
		String direction;
		if (room.getDmStatus() == DmStatus.ACCEPTED) {
			kind = "DIRECT";
			direction = null;
		}
		else if (room.getDmStatus() == DmStatus.REQUESTED
				&& room.getRequestExpiresAt() != null
				&& room.getRequestExpiresAt().isAfter(clock.instant())) {
			kind = "REQUEST";
			direction = Objects.equals(room.getRequesterId(), user.userId()) ? "SENT" : "RECEIVED";
		}
		else if (rejectionHiddenFrom(room, user.userId(), clock.instant())) {
			kind = "REQUEST";
			direction = "SENT";
		}
		else {
			throw new ApiException(404, "NOT_FOUND", "채팅방을 찾지 못했어요");
		}
		List<ChatMemberResponse> people = new ArrayList<>();
		ChatMemberResponse counterpart = null;
		for (ChatRoomMember member : members.findActiveInRoom(roomId)) {
			User person = accounts.findById(member.getUserId()).orElse(null);
			if (person == null) {
				continue;
			}
			if (!person.getId().equals(user.userId()) && moderation.blockedEitherWay(user.userId(), person.getId())) {
				throw new ApiException(404, "NOT_FOUND", "채팅방을 찾지 못했어요");
			}
			ChatMemberResponse view = memberView(person);
			people.add(view);
			if (counterpart == null && !person.getId().equals(user.userId())) {
				counterpart = view;
			}
		}
		if (counterpart == null) {
			throw new ApiException(404, "NOT_FOUND", "채팅방을 찾지 못했어요");
		}
		return new ChatRoomInfoResponse(
				room.getId(),
				kind,
				counterpart.name(),
				direction,
				membership.isMuted(),
				people,
				null,
				null
		);
	}

	@Transactional(readOnly = true)
	public UnreadSummaryResponse unreadSummary(AuthenticatedUser user) {
		ChatListSummary summary = rooms.listSummary(user.userId(), clock.instant());
		if (user.userType() == UserType.RECRUITER) {
			return new UnreadSummaryResponse(0, summary.directUnread(), 0, 0, summary.directUnread());
		}
		long total = summary.teamUnread() + summary.directUnread() + summary.requestUnread();
		return new UnreadSummaryResponse(
				summary.teamUnread(),
				summary.directUnread(),
				summary.requestUnread(),
				summary.requestCount(),
				total
		);
	}

	@Transactional
	public AcceptChatRequestResponse accept(AuthenticatedUser user, long roomId) {
		if (transition(user.userId(), roomId, true)) {
			events.publishEvent(new ChatRoomsChanged(user.userId(), roomId));
		}
		return new AcceptChatRequestResponse(roomId);
	}

	@Transactional
	public void deleteRequest(AuthenticatedUser user, long roomId) {
		if (transition(user.userId(), roomId, false)) {
			events.publishEvent(new ChatRoomsChanged(user.userId(), roomId));
		}
	}

	private boolean transition(long userId, long roomId, boolean accept) {
		ChatRoom room = rooms.lockById(roomId).orElseThrow(ChatService::missingRequest);
		members.findActive(roomId, userId).orElseThrow(ChatService::missingRequest);
		if (room.getRequesterId() != null && room.getRequesterId() == userId) {
			throw new ApiException(403, "FORBIDDEN", "요청을 처리할 수 없어요");
		}
		DmStatus status = room.getDmStatus();
		if (accept && status == DmStatus.ACCEPTED) {
			return false;
		}
		if (!accept && status == DmStatus.REJECTED) {
			return false;
		}
		Instant now = clock.instant();
		if (status != DmStatus.REQUESTED || room.getRequestExpiresAt() == null || !room.getRequestExpiresAt().isAfter(now)) {
			throw new ApiException(409, "STATE_CONFLICT", "이미 처리되었거나 만료된 요청이에요");
		}
		if (accept) {
			room.markAccepted(now);
		}
		else {
			room.markRejected(now);
		}
		return true;
	}

	/**
	 * POL-C-4. Mutual follows and current teammates get an open room. Anyone else needs a first message,
	 * which opens a 30-day request; without it nothing is stored and the caller is told to ask. A pending
	 * request in either direction is returned unchanged, and a rejection stays hidden from its sender for
	 * {@link PlanLimits#CHAT_REQUEST_DAYS}: the new message is dropped and the answer looks pending.
	 * Blocked pairs, recruiters and missing accounts are 404, like the profile.
	 */
	@Transactional
	public StartDirectChatResponse startDirect(AuthenticatedUser principal, StartDirectChatRequest request) {
		User me = requireActive(principal);
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
		if (moderation.blockedEitherWay(me.getId(), target.getId())) {
			throw new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요");
		}
		String firstMessage = firstMessage(request.message());
		String dmKey = Math.min(me.getId(), targetId) + ":" + Math.max(me.getId(), targetId);
		Instant now = DatabaseInstant.now(clock);
		boolean open = (follows.existsByFollower_IdAndFollowing_Id(me.getId(), targetId)
				&& follows.existsByFollower_IdAndFollowing_Id(targetId, me.getId()))
				|| teamMembers.existsSharedTeam(me.getId(), targetId);
		if (open) {
			boolean created = rooms.insertAcceptedIfAbsent(dmKey, me.getId(), now) == 1;
			ChatRoom room = rooms.lockByDmKey(dmKey).orElseThrow();
			boolean changed = created;
			if (room.getDmStatus() != DmStatus.ACCEPTED) {
				room.markAccepted(now);
				changed = true;
			}
			changed |= ensureMember(room, me.getId());
			changed |= ensureMember(room, targetId);
			if (changed) {
				announceRoom(room.getId(), me.getId(), targetId);
			}
			return StartDirectChatResponse.direct(room.getId());
		}
		ChatRoom room = rooms.lockByDmKey(dmKey).orElse(null);
		if (room != null) {
			StartDirectChatResponse current = currentDirectAnswer(room, me.getId(), targetId, now);
			if (current != null) {
				return current;
			}
		}
		if (firstMessage == null) {
			return StartDirectChatResponse.request(null);
		}
		Instant expiresAt = now.plus(Duration.ofDays(PlanLimits.CHAT_REQUEST_DAYS));
		if (room == null) {
			boolean created = rooms.insertRequestIfAbsent(dmKey, me.getId(), expiresAt, now) == 1;
			room = rooms.lockByDmKey(dmKey).orElseThrow();
			if (!created) {
				// Someone opened this pair between the read and the insert; answer from what they stored.
				StartDirectChatResponse current = currentDirectAnswer(room, me.getId(), targetId, now);
				return current != null ? current : StartDirectChatResponse.request(room.getId());
			}
		}
		else {
			room.reopenRequest(me.getId(), expiresAt);
		}
		ensureMember(room, me.getId());
		ensureMember(room, targetId);
		ChatMessage message = messages.saveAndFlush(ChatMessage.text(room, me.getId(), firstMessage));
		messages.assignCreatedAt(message.getId(), now);
		message.alignCreatedAt(now);
		room.markLastMessage(message.getId(), now);
		notifications.create(new CreateNotificationCommand(
				targetId,
				NotificationTypes.MESSAGE_REQUEST,
				me.getId(),
				"CHAT_ROOM",
				room.getId(),
				"/chats/" + room.getId(),
				"{\"roomId\":" + room.getId() + ",\"messageId\":" + message.getId() + "}",
				"message-request:" + room.getId()
		));
		announceRoom(room.getId(), me.getId(), targetId);
		return StartDirectChatResponse.request(room.getId());
	}

	/**
	 * What an existing pair row already answers without a new request, or null when a new request may
	 * replace it (expired, rejected over 30 days ago, rejected by me, or an open room the other person left).
	 */
	private StartDirectChatResponse currentDirectAnswer(ChatRoom room, long myId, long targetId, Instant now) {
		DmStatus status = room.getDmStatus();
		if (status == DmStatus.ACCEPTED) {
			ChatRoomMember other = members.findAnyInRoom(room.getId(), targetId).orElse(null);
			if (other == null || other.getLeftAt() != null) {
				return null;
			}
			if (ensureMember(room, myId)) {
				announceRoom(room.getId(), myId, targetId);
			}
			return StartDirectChatResponse.direct(room.getId());
		}
		if (status == DmStatus.REQUESTED && room.getRequestExpiresAt() != null && room.getRequestExpiresAt().isAfter(now)) {
			return StartDirectChatResponse.request(room.getId());
		}
		if (rejectionHiddenFrom(room, myId, now)) {
			return StartDirectChatResponse.request(room.getId());
		}
		return null;
	}

	/** The sender of a rejected request keeps seeing it as pending for {@link PlanLimits#CHAT_REQUEST_DAYS}. */
	private static boolean rejectionHiddenFrom(ChatRoom room, long viewerId, Instant now) {
		return room.getRoomType() == RoomType.DIRECT
				&& room.getDmStatus() == DmStatus.REJECTED
				&& Objects.equals(room.getRequesterId(), viewerId)
				&& room.getRespondedAt() != null
				&& room.getRespondedAt().plus(Duration.ofDays(PlanLimits.CHAT_REQUEST_DAYS)).isAfter(now);
	}

	/** Adds or brings back one person in a 1:1 room. Returns true when the row changed. */
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

	private void announceRoom(long roomId, long firstUserId, long secondUserId) {
		events.publishEvent(new ChatRoomsChanged(firstUserId, roomId));
		events.publishEvent(new ChatRoomsChanged(secondUserId, roomId));
	}

	private static String firstMessage(String raw) {
		if (raw == null || raw.isBlank()) {
			return null;
		}
		if (raw.codePointCount(0, raw.length()) > PlanLimits.CHAT_MESSAGE_MAX_CHARS) {
			throw new ApiException(400, "VALIDATION_ERROR", "메시지는 2000자까지 쓸 수 있어요");
		}
		return raw;
	}

	@Transactional(readOnly = true)
	public ChatMessagePageResponse messages(AuthenticatedUser user, long roomId, Long before, Long after) {
		if (before != null && after != null) {
			throw new ApiException(400, "VALIDATION_ERROR", "목록 위치를 확인해 주세요");
		}
		if ((before != null && before < 1) || (after != null && after < 1)) {
			throw new ApiException(400, "VALIDATION_ERROR", "목록 위치를 확인해 주세요");
		}
		ChatRoomMember member = members.findActive(roomId, user.userId())
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "채팅방을 찾지 못했어요"));
		boolean team = member.getRoom().getRoomType() == RoomType.TEAM;
		Instant start = historyStart(team);
		if (before != null) {
			requireAnchor(roomId, before);
		}
		if (after != null) {
			requireAnchor(roomId, after);
		}
		int limit = after == null ? MESSAGE_PAGE_SIZE : PlanLimits.CHAT_CATCH_UP_MAX;
		List<ChatMessageRow> rows = new ArrayList<>(after != null
				? messages.after(user.userId(), roomId, team, start, after, limit + 1)
				: before != null
						? messages.before(user.userId(), roomId, team, start, before, limit + 1)
						: messages.latest(user.userId(), roomId, team, start, limit + 1));
		boolean more = rows.size() > limit;
		if (more) {
			if (after != null) {
				rows.remove(rows.size() - 1);
			}
			else {
				rows.remove(0);
			}
		}
		boolean capped = after != null && more;
		Long nextAfter = capped && !rows.isEmpty() ? rows.get(rows.size() - 1).id() : null;
		return new ChatMessagePageResponse(
				toMessages(user.userId(), rows),
				more,
				capped,
				nextAfter,
				team ? new ChatHistoryLimitResponse(FREE_HISTORY, false) : null
		);
	}

	@Transactional
	public ChatMessageResponse shareCard(AuthenticatedUser principal, long roomId, ShareChatCardRequest request) {
		Participant participant = requireWritableParticipant(principal, roomId);
		if (request == null || request.targetType() == null || request.targetId() == null
				|| request.targetId() < 1 || request.clientMessageId() == null
				|| !canonicalUuid(request.clientMessageId())) {
			throw new ApiException(400, "VALIDATION_ERROR", "공유할 대상을 확인해 주세요");
		}
		String targetType = request.targetType().trim().toUpperCase();
		if (!Set.of("POST", "RECRUIT_POST", "PROFILE").contains(targetType)) {
			throw new ApiException(400, "VALIDATION_ERROR", "공유할 대상을 확인해 주세요");
		}
		RedisRateLimiter.Decision decision = rateLimiter.tryAcquire("chat.share", participant.account().getId(), PlanLimits.CHAT_SHARES_PER_MINUTE, 1);
		if (!decision.allowed()) {
			throw new ApiException(429, "RATE_LIMITED", "공유 요청이 너무 많아요",
					Map.of("retryAfterSeconds", decision.retryAfterSeconds()));
		}
		String payload = "{\"targetType\":\"" + targetType + "\",\"targetId\":" + request.targetId() + "}";
		ChatMessage message = messages.saveAndFlush(ChatMessage.shareCard(participant.member().getRoom(), participant.account().getId(), payload, request.clientMessageId()));
		Instant createdAt = DatabaseInstant.now(clock);
		messages.assignCreatedAt(message.getId(), createdAt);
		message.alignCreatedAt(createdAt);
		participant.member().getRoom().markLastMessage(message.getId(), createdAt);
		long unread = members.findActiveUserIds(roomId).stream().filter(id -> id != principal.userId()).count();
		ChatMessageResponse response = toMessage(message, participant.account(), unread, List.of());
		events.publishEvent(new ChatMessageReady(roomId, response));
		return response;
	}

	@Transactional
	public void markRead(AuthenticatedUser user, long roomId, MarkChatReadRequest request) {
		if (request == null || request.lastReadMessageId() == null || request.lastReadMessageId() < 1) {
			throw new ApiException(400, "VALIDATION_ERROR", "메시지 위치를 확인해 주세요");
		}
		long messageId = request.lastReadMessageId();
		ChatRoomMember member = members.lockActive(roomId, user.userId())
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "채팅방을 찾지 못했어요"));
		boolean team = member.getRoom().getRoomType() == RoomType.TEAM;
		requireAnchor(roomId, messageId);
		if (!messages.visibleTo(user.userId(), roomId, team, historyStart(team), messageId)) {
			throw new ApiException(400, "VALIDATION_ERROR", "메시지 위치를 확인해 주세요");
		}
		Long current = member.getLastReadMessageId();
		if (current != null && messageId <= current) {
			return;
		}
		member.readUntil(messageId);
		events.publishEvent(new ChatReadAdvanced(roomId, messageId));
		events.publishEvent(new ChatRoomsChanged(user.userId(), roomId));
	}

	@Transactional
	public ChatMessageResponse edit(AuthenticatedUser principal, long roomId, long messageId, EditChatMessageRequest request) {
		Participant participant = requireWritableParticipant(principal, roomId);
		ChatMessage message = lockVisible(participant, roomId, messageId);
		if (message.getMessageType() != MessageType.TEXT || !participant.account().getId().equals(message.getSenderId())) {
			throw new ApiException(403, "FORBIDDEN", "메시지를 수정할 수 없어요");
		}
		if (message.getDeletedAt() != null || message.getVisibility() != MessageVisibility.VISIBLE) {
			throw new ApiException(409, "STATE_CONFLICT", "수정할 수 없는 메시지예요");
		}
		String text = request == null ? null : request.text();
		if (text == null || text.isBlank()) {
			throw new ApiException(400, "VALIDATION_ERROR", "메시지 내용을 확인해 주세요");
		}
		if (text.codePointCount(0, text.length()) > PlanLimits.CHAT_MESSAGE_MAX_CHARS) {
			throw new ApiException(400, "VALIDATION_ERROR", "메시지는 2000자까지 쓸 수 있어요");
		}
		Instant deadline = message.getCreatedAt().plus(Duration.ofHours(PlanLimits.CHAT_EDIT_WITHIN_HOURS));
		if (clock.instant().isAfter(deadline)) {
			throw new ApiException(409, "STATE_CONFLICT", "메시지를 수정할 수 있는 시간이 지났어요");
		}
		message.revise(text, DatabaseInstant.now(clock));
		messages.saveAndFlush(message);
		ChatMessageResponse response = present(message);
		events.publishEvent(new ChatTranscriptChanged("EDIT", roomId, response));
		return response;
	}

	@Transactional
	public void deleteMessage(AuthenticatedUser principal, long roomId, long messageId) {
		Participant participant = requireWritableParticipant(principal, roomId);
		ChatMessage message = lockVisible(participant, roomId, messageId);
		ChatRoom room = participant.member().getRoom();
		boolean canModerate = room.getRoomType() == RoomType.TEAM
				&& room.getTeamId() != null
				&& teamChat.canModerate(participant.account().getId(), room.getTeamId());
		if (message.getSenderId() == null
				|| message.getMessageType() == MessageType.SYSTEM
				|| message.getMessageType() == MessageType.PR_EVENT
				|| (!participant.account().getId().equals(message.getSenderId()) && !canModerate)) {
			throw new ApiException(403, "FORBIDDEN", "메시지를 삭제할 수 없어요");
		}
		if (message.getVisibility() != MessageVisibility.VISIBLE) {
			throw new ApiException(409, "STATE_CONFLICT", "삭제할 수 없는 메시지예요");
		}
		if (message.getDeletedAt() != null) {
			return;
		}
		message.delete(DatabaseInstant.now(clock));
		messages.saveAndFlush(message);
		events.publishEvent(new ChatTranscriptChanged("DELETE", roomId, present(message)));
	}

	@Transactional(readOnly = true)
	public ChatMentionCandidatesResponse mentionCandidates(AuthenticatedUser principal, long roomId) {
		Participant participant = requireReader(principal, roomId);
		ChatRoom room = participant.member().getRoom();
		if (room.getRoomType() != RoomType.TEAM || room.getTeamId() == null) {
			throw new ApiException(403, "FORBIDDEN", "팀 채팅에서만 멘션할 수 있어요");
		}
		if (teamChat.readableBy(participant.account().getId(), room.getTeamId()) == null) {
			throw new ApiException(404, "NOT_FOUND", "채팅방을 찾지 못했어요");
		}
		return new ChatMentionCandidatesResponse(teamChat.mentionCandidates(participant.account().getId(), room.getTeamId()));
	}

	@Transactional(readOnly = true)
	public UnreadMembersResponse unreadMembers(AuthenticatedUser principal, long roomId, long messageId) {
		Participant participant = requireReader(principal, roomId);
		if (participant.member().getRoom().getRoomType() != RoomType.TEAM) {
			throw new ApiException(403, "FORBIDDEN", "1:1 채팅에서는 참여자 목록을 보여 주지 않아요");
		}
		ChatMessage message = visibleMessage(participant, roomId, messageId);
		List<ChatMemberResponse> items = new ArrayList<>();
		for (ChatRoomMember member : members.findActiveInRoom(roomId)) {
			if (message.getSenderId() != null && message.getSenderId().equals(member.getUserId())) {
				continue;
			}
			Long read = member.getLastReadMessageId();
			if (read != null && read >= message.getId()) {
				continue;
			}
			boolean team = true;
			if (!messages.visibleTo(member.getUserId(), roomId, team, historyStart(team), message.getId())) {
				continue;
			}
			User account = accounts.findById(member.getUserId()).orElse(null);
			if (account == null) {
				continue;
			}
			items.add(new ChatMemberResponse(account.getId(), account.getUsername(), account.visibleName(), account.getAvatarUrl()));
		}
		return new UnreadMembersResponse(items);
	}

	@Transactional
	public void updateNotification(AuthenticatedUser principal, long roomId, UpdateChatNotificationRequest request) {
		if (request == null || request.muted() == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "알림 설정을 확인해 주세요");
		}
		User account = requireActive(principal);
		ChatRoomMember member = members.lockActive(roomId, account.getId())
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "채팅방을 찾지 못했어요"));
		if (member.isMuted() == request.muted()) {
			return;
		}
		member.mute(request.muted());
		events.publishEvent(new ChatRoomsChanged(account.getId(), roomId));
	}

	@Transactional
	public void leave(AuthenticatedUser principal, long roomId) {
		User account = requireActive(principal);
		ChatRoomMember member = members.lockActive(roomId, account.getId())
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "채팅방을 찾지 못했어요"));
		member.leave(DatabaseInstant.now(clock));
		events.publishEvent(new ChatRoomsChanged(account.getId(), roomId));
	}

	/**
	 * Current safe row for a subscriber. Delivery may reorder frames, so a snapshot taken at
	 * commit is not what the socket sends.
	 */
	@Transactional(readOnly = true)
	public ChatMessageResponse currentTranscript(long viewerId, long roomId, long messageId) {
		if (!visibleTo(viewerId, roomId, messageId)) {
			return null;
		}
		ChatMessage message = messages.findWithRoom(messageId).orElse(null);
		if (message == null || !message.getRoom().getId().equals(roomId)) {
			return null;
		}
		return present(message);
	}

	@Transactional(readOnly = true)
	public boolean visibleTo(long viewerId, long roomId, long messageId) {
		ChatRoomMember member = members.findActive(roomId, viewerId).orElse(null);
		if (member == null) {
			return false;
		}
		boolean team = member.getRoom().getRoomType() == RoomType.TEAM;
		return messages.visibleTo(viewerId, roomId, team, historyStart(team), messageId);
	}

	private boolean storeNewText(User account, long roomId, SendCommand command) {
		User current = accounts.findById(account.getId()).orElseThrow(() -> new StompAuthException("로그인이 필요해요"));
		if (current.getStatus() != UserStatus.ACTIVE) {
			reject(current.getId(), roomId, command.clientMessageId(), "FORBIDDEN", "이 기능을 사용할 수 없어요", false, null);
			return false;
		}
		ChatRoom room = rooms.lockById(roomId).orElseThrow(() -> new StompAuthException("채팅방에 참여할 수 없어요"));
		if (members.findActive(roomId, current.getId()).isEmpty() || !room.admitsSender()) {
			throw new StompAuthException("채팅방에 참여할 수 없어요");
		}
		if (room.getRoomType() == RoomType.TEAM
				&& (room.getTeamId() == null || !teamChat.writableBy(current.getId(), room.getTeamId()))) {
			reject(current.getId(), roomId, command.clientMessageId(), "FORBIDDEN", "팀 채팅에 메시지를 보낼 수 없어요", false, null);
			return false;
		}
		if (command.mentionAll() && (room.getRoomType() != RoomType.TEAM || room.getTeamId() == null
				|| !teamChat.canModerate(current.getId(), room.getTeamId()))) {
			reject(current.getId(), roomId, command.clientMessageId(), "FORBIDDEN", "@전체 멘션은 팀 오너 또는 관리자만 사용할 수 있어요", false, null);
			return false;
		}
		ChatMessage existing = messages.findBySenderIdAndClientMessageId(current.getId(), command.clientMessageId()).orElse(null);
		if (existing != null) {
			confirmStored(current.getId(), roomId, command);
			return false;
		}
		List<UploadedFile> files = readyChatFiles(current.getId(), roomId, command);
		if (files == null) {
			return false;
		}
		RedisRateLimiter.Decision decision;
		try {
			decision = rateLimiter.tryAcquire(CHAT_SEND_BUCKET, current.getId(), PlanLimits.CHAT_SENDS_PER_SECOND, 1);
		}
		catch (DataAccessException exception) {
			reject(current.getId(), roomId, command.clientMessageId(), "SERVICE_UNAVAILABLE", "잠시 후 다시 시도해 주세요", true, null);
			return false;
		}
		if (!decision.allowed()) {
			reject(current.getId(), roomId, command.clientMessageId(), "RATE_LIMITED", "요청이 너무 많아요. 잠시 후 다시 시도해 주세요", true, decision.retryAfterSeconds());
			return false;
		}
		Instant createdAt = DatabaseInstant.now(clock);
		ChatMessage message = messages.saveAndFlush(command.type() == MessageType.IMAGE
				? ChatMessage.clientImage(room, current.getId(), command.clientMessageId())
				: ChatMessage.clientText(room, current.getId(), command.body(), command.clientMessageId()));
		messages.assignCreatedAt(message.getId(), createdAt);
		message.alignCreatedAt(createdAt);
		if (!message.getRoom().getId().equals(room.getId())) {
			throw new IllegalStateException("message room mismatch");
		}
		List<String> imageUrls = new ArrayList<>();
		for (int index = 0; index < files.size(); index++) {
			UploadedFile file = files.get(index);
			imageLinks.saveAndFlush(ChatMessageImage.link(message, file, index));
			imageUrls.add(file.getUrl());
		}
		room.markLastMessage(message.getId(), createdAt);
		List<Long> recipientIds = members.findActiveUserIds(roomId).stream()
				.filter(id -> id != current.getId())
				.filter(id -> messages.visibleTo(id, roomId, room.getRoomType() == RoomType.TEAM,
						historyStart(room.getRoomType() == RoomType.TEAM), message.getId()))
				.toList();
		long unread = recipientIds.size();
		events.publishEvent(new ChatMessageReady(roomId, toMessage(message, current, unread, imageUrls)));
		boolean team = room.getRoomType() == RoomType.TEAM;
		if (team) {
			storeMentions(message, room, current, command, recipientIds);
		}
		if (!team) {
			for (Long recipientId : recipientIds) {
				notifications.create(new CreateNotificationCommand(
						recipientId,
						NotificationTypes.CHAT,
						current.getId(),
						"CHAT_ROOM",
						roomId,
						"/chats/" + roomId,
						"{\"roomId\":" + roomId + ",\"messageId\":" + message.getId() + "}",
						"chat:" + roomId
				));
			}
		}
		for (Long memberId : members.findActiveUserIds(roomId)) {
			boolean visible = memberId == current.getId()
					|| messages.visibleTo(memberId, roomId, team, historyStart(team), message.getId());
			if (visible) {
				events.publishEvent(new ChatRoomsChanged(memberId, roomId));
			}
		}
		return true;
	}

	/**
	 * Team rooms only notify on mentions (Policy ch. 8). A mentioned id counts only if that person is an
	 * active team member who can read the message; anything else is dropped and the message still goes out.
	 * {@code @person} rings even when the room is muted ({@code CHAT_MENTION}). {@code @all} is an ordinary
	 * {@code CHAT} notification, so muted members are skipped by the push job, and someone who is also
	 * mentioned by name gets the mention only.
	 */
	private void storeMentions(
			ChatMessage message, ChatRoom room, User sender, SendCommand command, List<Long> recipientIds
	) {
		if (command.mentionedUserIds().isEmpty() && !command.mentionAll()) {
			return;
		}
		Set<Long> mentionable = teamChat.mentionCandidates(sender.getId(), room.getTeamId()).stream()
				.map(ChatMemberResponse::id)
				.collect(Collectors.toSet());
		List<Long> reachable = recipientIds.stream().filter(mentionable::contains).toList();
		List<Long> people = command.mentionedUserIds().stream().filter(reachable::contains).toList();
		for (Long personId : people) {
			mentions.save(ChatMessageMention.person(message, personId));
			notifications.create(roomNotification(personId, sender, room, message, NotificationTypes.CHAT_MENTION, "mention"));
		}
		if (command.mentionAll()) {
			mentions.save(ChatMessageMention.everyone(message));
			for (Long memberId : reachable) {
				if (!people.contains(memberId)) {
					notifications.create(roomNotification(memberId, sender, room, message, NotificationTypes.CHAT, "mentionAll"));
				}
			}
		}
	}

	private static CreateNotificationCommand roomNotification(
			long recipientId, User sender, ChatRoom room, ChatMessage message, String type, String flag
	) {
		return new CreateNotificationCommand(
				recipientId,
				type,
				sender.getId(),
				"CHAT_ROOM",
				room.getId(),
				"/chats/" + room.getId(),
				"{\"roomId\":" + room.getId() + ",\"messageId\":" + message.getId() + ",\"" + flag + "\":true}",
				"chat:" + room.getId()
		);
	}

	private void confirmStored(long userId, long roomId, SendCommand command) {
		ChatMessage existing = messages.findBySenderIdAndClientMessageId(userId, command.clientMessageId()).orElse(null);
		if (existing == null || !sameRequest(existing, roomId, command)) {
			reject(userId, roomId, command.clientMessageId(), "CONFLICT", "이미 사용한 메시지 식별자예요", false, null);
			return;
		}
		events.publishEvent(new ChatSendAccepted(userId, roomId, command.clientMessageId(), existing.getId()));
	}

	private boolean sameRequest(ChatMessage existing, long roomId, SendCommand command) {
		String storedBody = existing.getBody() == null ? "" : existing.getBody();
		return existing.getMessageType() == command.type()
				&& command.body().equals(storedBody)
				&& existing.getRoom().getId().equals(roomId)
				&& imageLinks.findFileIds(existing.getId()).equals(command.fileIds());
	}

	/**
	 * @return completed CHAT files in request order, or null when the send was rejected
	 */
	private List<UploadedFile> readyChatFiles(long userId, long roomId, SendCommand command) {
		if (command.fileIds().isEmpty()) {
			return List.of();
		}
		try {
			List<UploadedFile> files = new ArrayList<>();
			for (Long fileId : command.fileIds()) {
				UploadedFile file = uploads.requireReady(fileId, userId);
				if (file.getPurpose() != UploadPurpose.CHAT || file.getUrl() == null || file.getUrl().isBlank()) {
					throw new ApiException(400, "VALIDATION_ERROR", "파일 용도를 확인해 주세요");
				}
				files.add(file);
			}
			return files;
		}
		catch (ApiException exception) {
			reject(userId, roomId, command.clientMessageId(), exception.getCode(), exception.getMessage(), false, null);
			return null;
		}
	}

	private void reject(
			long userId,
			long roomId,
			String clientMessageId,
			String code,
			String message,
			boolean retryable,
			Long retryAfterSeconds
	) {
		events.publishEvent(new ChatSendRejected(userId, roomId, clientMessageId, code, message, retryable, retryAfterSeconds));
	}

	private Participant requireWritableParticipant(AuthenticatedUser principal, long roomId) {
		Participant participant = requireParticipant(principal, roomId);
		ChatRoom room = participant.member().getRoom();
		if (room.getRoomType() == RoomType.TEAM
				&& (room.getTeamId() == null || !teamChat.writableBy(principal.userId(), room.getTeamId()))) {
			throw new ApiException(403, "FORBIDDEN", "팀 채팅을 변경할 수 없어요");
		}
		return participant;
	}

	private Participant requireParticipant(AuthenticatedUser principal, long roomId) {
		return member(requireActive(principal), roomId);
	}

	private Participant requireReader(AuthenticatedUser principal, long roomId) {
		User account = requireKnown(principal);
		if (account.getStatus() != UserStatus.ACTIVE && account.getStatus() != UserStatus.SUSPENDED) {
			throw new ApiException(403, "FORBIDDEN", "이 기능을 사용할 수 없어요");
		}
		return member(account, roomId);
	}

	private Participant member(User account, long roomId) {
		ChatRoomMember membership = members.findActive(roomId, account.getId())
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "채팅방을 찾지 못했어요"));
		return new Participant(account, membership);
	}

	private User requireKnown(AuthenticatedUser principal) {
		// LOGIN_REQUIRED opens the login sheet; UNAUTHORIZED is reserved for webhook signatures.
		if (principal == null) {
			throw new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요");
		}
		return accounts.findById(principal.userId())
				.orElseThrow(() -> new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요"));
	}

	private User requireActive(AuthenticatedUser principal) {
		User account = requireKnown(principal);
		// A token issued before the suspension passes AccountStateFilter; answer with the same code.
		if (account.getStatus() == UserStatus.SUSPENDED) {
			throw new ApiException(403, "SUSPENDED", "정지된 계정은 이 기능을 쓸 수 없어요");
		}
		if (account.getStatus() != UserStatus.ACTIVE) {
			throw new ApiException(403, "FORBIDDEN", "이 기능을 사용할 수 없어요");
		}
		return account;
	}

	private ChatMessage lockVisible(Participant participant, long roomId, long messageId) {
		assertVisible(participant, roomId, messageId);
		return messages.lockById(messageId)
				.orElseThrow(() -> new ApiException(400, "VALIDATION_ERROR", "메시지 위치를 확인해 주세요"));
	}

	private ChatMessage visibleMessage(Participant participant, long roomId, long messageId) {
		assertVisible(participant, roomId, messageId);
		return messages.findWithRoom(messageId)
				.orElseThrow(() -> new ApiException(400, "VALIDATION_ERROR", "메시지 위치를 확인해 주세요"));
	}

	private void assertVisible(Participant participant, long roomId, long messageId) {
		boolean team = participant.member().getRoom().getRoomType() == RoomType.TEAM;
		Long owner = messages.findRoomId(messageId).orElse(null);
		if (owner == null || owner != roomId || !messages.visibleTo(
				participant.account().getId(),
				roomId,
				team,
				historyStart(team),
				messageId
		)) {
			throw new ApiException(400, "VALIDATION_ERROR", "메시지 위치를 확인해 주세요");
		}
	}

	private ChatMessageResponse present(ChatMessage message) {
		boolean redacted = message.getDeletedAt() != null || message.getVisibility() != MessageVisibility.VISIBLE;
		String text = message.getDeletedAt() != null
				? DELETED_PREVIEW
				: message.getVisibility() == MessageVisibility.HIDDEN ? HIDDEN_PREVIEW : message.getBody();
		User sender = message.getSenderId() == null ? null : accounts.findById(message.getSenderId()).orElse(null);
		return new ChatMessageResponse(
				message.getId(),
				message.getRoom().getId(),
				unreadCount(message),
				message.getClientMessageId(),
				sender == null ? null : new ChatMemberResponse(
						sender.getId(),
						sender.getUsername(),
						sender.visibleName(),
						sender.getAvatarUrl()
				),
				message.getMessageType().name(),
				text,
				redacted ? List.of() : imageLinks.findUrls(message.getId()),
				null,
				message.getCreatedAt(),
				message.getEditedAt(),
				message.getDeletedAt(),
				message.getVisibility().name()
		);
	}

	private long unreadCount(ChatMessage message) {
		Long senderId = message.getSenderId();
		return members.findActiveInRoom(message.getRoom().getId()).stream()
				.filter(member -> senderId == null || !senderId.equals(member.getUserId()))
				.filter(member -> member.getLastReadMessageId() == null || member.getLastReadMessageId() < message.getId())
				.count();
	}

	private record Participant(User account, ChatRoomMember member) {
	}

	private void requireAnchor(long roomId, long messageId) {
		Long owner = messages.findRoomId(messageId).orElse(null);
		if (owner == null || owner != roomId) {
			throw new ApiException(400, "VALIDATION_ERROR", "메시지 위치를 확인해 주세요");
		}
	}

	private Instant historyStart(boolean team) {
		if (!team) {
			return null;
		}
		return clock.instant().minus(Duration.ofDays(PlanLimits.TEAM_CHAT_HISTORY_DAYS_FREE));
	}

	private List<ChatMessageResponse> toMessages(long viewerId, List<ChatMessageRow> rows) {
		if (rows.isEmpty()) {
			return List.of();
		}
		Map<Long, List<String>> urls = messages.imageUrls(rows.stream().map(ChatMessageRow::id).toList());
		return rows.stream()
				.map(row -> toMessage(row, urls.getOrDefault(row.id(), List.of()), cardPayload(viewerId, row)))
				.toList();
	}

	private Object cardPayload(long viewerId, ChatMessageRow row) {
		if (!"SHARE_CARD".equals(row.type()) || row.payload() == null || row.payload().isBlank()) {
			return row.payload();
		}
		try {
			JsonNode payload = json.readTree(row.payload());
			String targetType = payload.path("targetType").asText();
			long targetId = payload.path("targetId").asLong();
			if (targetType.isBlank() || targetId < 1) {
				return com.linker.backend.dto.chat.response.ChatShareCardResponse.unavailable(targetType, targetId);
			}
			return messages.resolveShareCard(viewerId, targetType, targetId);
		}
		catch (RuntimeException exception) {
			return com.linker.backend.dto.chat.response.ChatShareCardResponse.unavailable("UNKNOWN", 0);
		}
	}

	private static SendCommand sendCommand(Map<String, Object> payload) {
		if (payload == null || unsupportedAttachment(payload)) {
			throw new StompAuthException(payload == null || !unsupportedAttachment(payload)
					? "메시지 내용을 확인해 주세요" : "텍스트 메시지만 보낼 수 있어요");
		}
		Object textValue = payload.get("text");
		final String text;
		if (textValue == null) {
			text = "";
		}
		else if (textValue instanceof String value) {
			text = value;
		}
		else {
			throw new StompAuthException("메시지 내용을 확인해 주세요");
		}
		if (text.codePointCount(0, text.length()) > PlanLimits.CHAT_MESSAGE_MAX_CHARS) {
			throw new StompAuthException("메시지는 2000자까지 쓸 수 있어요");
		}
		List<Long> fileIds = fileIds(payload.get("fileIds"));
		if (text.isBlank() && fileIds.isEmpty()) {
			throw new StompAuthException("메시지 내용을 확인해 주세요");
		}
		Object rawId = payload.get("clientMessageId");
		if (!(rawId instanceof String clientId) || !canonicalUuid(clientId)) {
			throw new StompAuthException("메시지 식별자를 확인해 주세요");
		}
		boolean mentionAll = mentionAll(payload.get("mentionAll")) || hasAllMention(text);
		List<Long> mentionedUserIds = mentionedUserIds(payload.get("mentionedUserIds"));
		if (text.isBlank()) {
			return new SendCommand(clientId, MessageType.IMAGE, "", fileIds, mentionAll, mentionedUserIds);
		}
		return new SendCommand(clientId, MessageType.TEXT, text, fileIds, mentionAll, mentionedUserIds);
	}

	private static List<Long> fileIds(Object raw) {
		if (raw == null) {
			return List.of();
		}
		if (!(raw instanceof List<?> list)) {
			throw new StompAuthException("메시지 내용을 확인해 주세요");
		}
		if (list.isEmpty()) {
			return List.of();
		}
		if (list.size() > PlanLimits.CHAT_IMAGES_PER_SEND) {
			throw new StompAuthException("메시지 내용을 확인해 주세요");
		}
		List<Long> ids = new ArrayList<>();
		Set<Long> seen = new HashSet<>();
		for (Object item : list) {
			long id = fileId(item);
			if (!seen.add(id)) {
				throw new StompAuthException("메시지 내용을 확인해 주세요");
			}
			ids.add(id);
		}
		return List.copyOf(ids);
	}

	/** Ids picked from the autocomplete. Repeats are dropped; anything that is not a positive id is rejected. */
	private static List<Long> mentionedUserIds(Object raw) {
		if (raw == null) {
			return List.of();
		}
		if (!(raw instanceof List<?> list) || list.size() > MAX_MENTIONED_IDS) {
			throw new StompAuthException("메시지 내용을 확인해 주세요");
		}
		Set<Long> ids = new LinkedHashSet<>();
		for (Object item : list) {
			ids.add(fileId(item));
		}
		return List.copyOf(ids);
	}

	private static long fileId(Object raw) {
		if (raw instanceof String text) {
			return canonicalFileId(text);
		}
		if (raw instanceof Integer || raw instanceof Long) {
			long value = ((Number) raw).longValue();
			if (value < 1) {
				throw new StompAuthException("메시지 내용을 확인해 주세요");
			}
			return value;
		}
		throw new StompAuthException("메시지 내용을 확인해 주세요");
	}

	private static long canonicalFileId(String text) {
		try {
			if (text.isEmpty() || text.length() > 19 || text.chars().anyMatch(ch -> ch < '0' || ch > '9')) {
				throw new NumberFormatException();
			}
			long value = Long.parseLong(text);
			if (value < 1 || !Long.toString(value).equals(text)) {
				throw new NumberFormatException();
			}
			return value;
		}
		catch (NumberFormatException exception) {
			throw new StompAuthException("메시지 내용을 확인해 주세요");
		}
	}

	private static boolean unsupportedAttachment(Map<String, Object> payload) {
		return present(payload.get("issueRefs"))
				|| foreignType(payload.get("messageType"))
				|| foreignType(payload.get("type"));
	}

	private static boolean mentionAll(Object raw) {
		if (raw == null) {
			return false;
		}
		if (raw instanceof Boolean value) {
			return value;
		}
		throw new StompAuthException("메시지 내용을 확인해 주세요");
	}

	private static boolean hasAllMention(String text) {
		return text.matches("(?s).*?(?<![\\p{L}\\p{N}_])@(?:(?i:all)|전체)(?![\\p{L}\\p{N}_]).*");
	}

	private static boolean present(Object value) {
		if (value instanceof List<?> list) {
			return !list.isEmpty();
		}
		if (value instanceof String text) {
			return !text.isBlank();
		}
		return false;
	}

	private static boolean foreignType(Object value) {
		return value instanceof String text && !text.isBlank() && !"TEXT".equals(text) && !"IMAGE".equals(text);
	}

	private static boolean canonicalUuid(String raw) {
		try {
			return raw.equals(UUID.fromString(raw).toString());
		}
		catch (IllegalArgumentException exception) {
			return false;
		}
	}

	private static ChatMemberResponse memberView(User person) {
		boolean withdrawn = person.getStatus() == UserStatus.DELETED;
		return new ChatMemberResponse(
				person.getId(),
				withdrawn ? null : person.getUsername(),
				withdrawn ? WITHDRAWN_MEMBER : person.visibleName(),
				withdrawn ? null : person.getAvatarUrl()
		);
	}

	private static ChatMessageResponse toMessage(ChatMessage message, User sender, long unreadCount, List<String> imageUrls) {
		return new ChatMessageResponse(
				message.getId(),
				message.getRoom().getId(),
				unreadCount,
				message.getClientMessageId(),
				new ChatMemberResponse(sender.getId(), sender.getUsername(), sender.visibleName(), sender.getAvatarUrl()),
				message.getMessageType().name(),
				message.getBody(),
				imageUrls,
				message.getPayload(),
				message.getCreatedAt(),
				message.getEditedAt(),
				null,
				"VISIBLE"
		);
	}

	private static ChatMessageResponse toMessage(ChatMessageRow row, List<String> imageUrls, Object payload) {
		boolean redacted = row.deletedAt() != null || "HIDDEN".equals(row.visibility());
		String text = row.deletedAt() != null ? DELETED_PREVIEW : "HIDDEN".equals(row.visibility()) ? HIDDEN_PREVIEW : row.body();
		boolean withdrawn = "DELETED".equals(row.senderStatus());
		ChatMemberResponse sender = row.senderId() == null ? null : new ChatMemberResponse(
				row.senderId(),
				withdrawn ? null : row.username(),
				withdrawn ? WITHDRAWN_MEMBER : visibleName(row.displayName(), row.username()),
				withdrawn ? null : row.avatarUrl()
		);
		return new ChatMessageResponse(
				row.id(),
				row.roomId(),
				row.unreadCount(),
				row.clientMessageId(),
				sender,
				row.type(),
				text,
				redacted ? List.of() : imageUrls,
				redacted ? null : payload,
				row.createdAt(),
				row.editedAt(),
				row.deletedAt(),
				row.visibility()
		);
	}

	private String resolveTab(AuthenticatedUser user, String rawTab) {
		boolean recruiter = user.userType() == UserType.RECRUITER;
		String tab = rawTab == null || rawTab.isBlank() ? (recruiter ? "DIRECT" : "TEAM") : rawTab;
		if (!tab.equals("TEAM") && !tab.equals("DIRECT") && !tab.equals("REQUEST")) {
			throw new ApiException(400, "VALIDATION_ERROR", "채팅 종류를 확인해 주세요");
		}
		if (recruiter && !tab.equals("DIRECT")) {
			throw new ApiException(403, "FORBIDDEN", "이 기능을 사용할 수 없어요");
		}
		return tab;
	}

	private Cursor decodeCursor(long userId, String tab, String rawCursor, Instant now) {
		if (rawCursor == null || rawCursor.isBlank()) {
			return null;
		}
		ParsedCursor parsed = parseCursor(rawCursor);
		if (parsed.version() != CURSOR_VERSION || parsed.userId() != userId || !parsed.tab().equals(tab)) {
			throw badCursor();
		}
		if (!rooms.containedInTab(userId, tab, parsed.roomId(), now)) {
			throw badCursor();
		}
		return new Cursor(parsed.sortAt(), parsed.roomId());
	}

	private static ParsedCursor parseCursor(String rawCursor) {
		if (rawCursor.length() > MAX_CURSOR_LENGTH) {
			throw badCursor();
		}
		final String decoded;
		try {
			byte[] bytes = Base64.getUrlDecoder().decode(rawCursor);
			if (bytes.length > 96) {
				throw badCursor();
			}
			decoded = new String(bytes, StandardCharsets.UTF_8);
		}
		catch (IllegalArgumentException exception) {
			throw badCursor();
		}
		String[] parts = decoded.split(":", -1);
		if (parts.length != 5) {
			throw badCursor();
		}
		try {
			int version = canonicalInt(parts[0]);
			long ownerId = canonicalLong(parts[1]);
			String tokenTab = parts[2];
			if (!tokenTab.equals("TEAM") && !tokenTab.equals("DIRECT") && !tokenTab.equals("REQUEST")) {
				throw badCursor();
			}
			int dot = parts[3].indexOf('.');
			if (dot <= 0 || dot != parts[3].lastIndexOf('.')) {
				throw badCursor();
			}
			long seconds = canonicalLong(parts[3].substring(0, dot));
			int nanos = canonicalInt(parts[3].substring(dot + 1));
			long roomId = canonicalLong(parts[4]);
			if (nanos < 0 || nanos > 999_999_999 || ownerId < 1 || roomId < 1) {
				throw badCursor();
			}
			Instant sortAt = Instant.ofEpochSecond(seconds, nanos);
			if (sortAt.getEpochSecond() != seconds || sortAt.getNano() != nanos) {
				throw badCursor();
			}
			return new ParsedCursor(version, ownerId, tokenTab, sortAt, roomId);
		}
		catch (NumberFormatException | DateTimeException exception) {
			throw badCursor();
		}
	}

	private static int canonicalInt(String raw) {
		if (raw.isEmpty() || raw.length() > 9) {
			throw new NumberFormatException();
		}
		int value = Integer.parseInt(raw);
		if (!Integer.toString(value).equals(raw)) {
			throw new NumberFormatException();
		}
		return value;
	}

	private static long canonicalLong(String raw) {
		if (raw.isEmpty() || raw.length() > 20) {
			throw new NumberFormatException();
		}
		long value = Long.parseLong(raw);
		if (!Long.toString(value).equals(raw)) {
			throw new NumberFormatException();
		}
		return value;
	}

	private static String encodeCursor(long userId, String tab, Instant sortAt, long roomId) {
		String raw = CURSOR_VERSION + ":" + userId + ":" + tab + ":"
				+ sortAt.getEpochSecond() + "." + sortAt.getNano() + ":" + roomId;
		return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
	}

	private static ApiException badCursor() {
		return new ApiException(400, "VALIDATION_ERROR", "목록 위치를 확인해 주세요");
	}

	private static ChatRoomItemResponse toItem(String tab, ChatListRow row) {
		boolean team = "TEAM".equals(row.roomType());
		boolean withdrawn = "DELETED".equals(row.counterpartStatus());
		String title = team ? null : withdrawn ? WITHDRAWN_MEMBER : visibleName(row.displayName(), row.username());
		ChatCounterpartResponse counterpart = team || row.username() == null
				? null
				: new ChatCounterpartResponse(withdrawn ? null : row.avatarUrl());
		ChatLastMessageResponse lastMessage = row.previewCreatedAt() == null
				? null
				: new ChatLastMessageResponse(previewText(row), row.previewCreatedAt());
		return new ChatRoomItemResponse(
				row.roomId(),
				tab,
				title,
				counterpart,
				row.requestKind(),
				"REQUEST".equals(tab) ? "RECEIVED" : null,
				null,
				row.muted(),
				row.unreadCount(),
				lastMessage
		);
	}

	private static String previewText(ChatListRow row) {
		if (row.previewDeletedAt() != null) {
			return DELETED_PREVIEW;
		}
		if ("HIDDEN".equals(row.previewVisibility())) {
			return HIDDEN_PREVIEW;
		}
		return row.previewBody();
	}

	private static final String WITHDRAWN_MEMBER = "탈퇴한 사용자";

	private static String visibleName(String displayName, String username) {
		if (displayName != null && !displayName.isBlank()) {
			return displayName;
		}
		return username;
	}

	private static ApiException missingRequest() {
		return new ApiException(404, "NOT_FOUND", "요청을 찾지 못했어요");
	}

	private record Cursor(Instant sortAt, long roomId) {
	}

	private record ParsedCursor(int version, long userId, String tab, Instant sortAt, long roomId) {
	}

	private record SendCommand(
			String clientMessageId, MessageType type, String body, List<Long> fileIds, boolean mentionAll,
			List<Long> mentionedUserIds
	) {
	}
}
