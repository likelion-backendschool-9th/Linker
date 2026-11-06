package com.linker.backend.service.user;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

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
import com.linker.backend.dto.chat.response.AcceptChatRequestResponse;
import com.linker.backend.dto.chat.response.ChatCounterpartResponse;
import com.linker.backend.dto.chat.response.ChatHistoryLimitResponse;
import com.linker.backend.dto.chat.response.ChatLastMessageResponse;
import com.linker.backend.dto.chat.response.ChatMemberResponse;
import com.linker.backend.dto.chat.response.ChatMessagePageResponse;
import com.linker.backend.dto.chat.response.ChatMessageResponse;
import com.linker.backend.dto.chat.response.ChatRoomInfoResponse;
import com.linker.backend.dto.chat.response.ChatRoomItemResponse;
import com.linker.backend.dto.chat.response.ChatRoomPageResponse;
import com.linker.backend.dto.chat.response.UnreadMembersResponse;
import com.linker.backend.dto.chat.response.UnreadSummaryResponse;
import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.entity.chat.ChatMessage;
import com.linker.backend.entity.chat.ChatMessageImage;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.entity.chat.DmStatus;
import com.linker.backend.entity.chat.MessageType;
import com.linker.backend.entity.chat.MessageVisibility;
import com.linker.backend.entity.chat.RoomType;
import com.linker.backend.entity.file.UploadPurpose;
import com.linker.backend.entity.file.UploadedFile;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.time.DatabaseInstant;
import com.linker.backend.global.realtime.ChatRoomAccess;
import com.linker.backend.global.realtime.StompAuthException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.RedisRateLimiter;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.chat.ChatListQueryRepository;
import com.linker.backend.repository.chat.ChatListQueryRepository.ChatListRow;
import com.linker.backend.repository.chat.ChatListQueryRepository.ChatListSummary;
import com.linker.backend.repository.chat.ChatMessageImageRepository;
import com.linker.backend.repository.chat.ChatMessageQueryRepository;
import com.linker.backend.repository.chat.ChatMessageQueryRepository.ChatMessageRow;
import com.linker.backend.repository.chat.ChatMessageRepository;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.chat.ChatRoomRepository;
import com.linker.backend.entity.notification.NotificationTypes;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Paired entry for {@link com.linker.backend.controller.user.UserChatController}.
 * Page 16 reads chat rows. Page 17 stores DIRECT text and chat images, opens DIRECT and request rooms,
 * and handles the caller's own edit, delete, read, and mute.
 * Team room info and deleting someone else's message stay closed until a real team role source exists.
 */
@Service
public class UserChatService {

	/** Technical page size, not a Policy limit. */
	static final int PAGE_SIZE = 20;

	/** Technical history page, distinct from {@link PlanLimits#CHAT_CATCH_UP_MAX}. */
	static final int MESSAGE_PAGE_SIZE = 30;

	private static final String CHAT_SEND_BUCKET = "chat.send";
	private static final String FREE_HISTORY = "FREE_60_DAYS";

	/** Context binding only. The token is not an authenticator or an integrity seal. */
	private static final int CURSOR_VERSION = 1;
	private static final int MAX_CURSOR_LENGTH = 160;

	static final String DELETED_PREVIEW = "삭제된 메시지입니다";
	static final String HIDDEN_PREVIEW = "운영 정책에 따라 숨겨진 메시지예요";

	private final ChatRoomAccess chatRooms;
	private final ChatListQueryRepository lists;
	private final ChatRoomRepository rooms;
	private final ChatRoomMemberRepository members;
	private final ApplicationEventPublisher events;
	private final Clock clock;
	private final UserRepository accounts;
	private final ChatMessageRepository messages;
	private final ChatMessageQueryRepository messageQuery;
	private final RedisRateLimiter rateLimiter;
	private final TransactionTemplate transactions;
	private final UserModerationService moderation;
	private final UserUploadService uploads;
	private final ChatMessageImageRepository imageLinks;
	private final UserNotificationService notifications;

	public UserChatService(
			ChatRoomAccess chatRooms,
			ChatListQueryRepository lists,
			ChatRoomRepository rooms,
			ChatRoomMemberRepository members,
			ApplicationEventPublisher events,
			Clock clock,
			UserRepository accounts,
			ChatMessageRepository messages,
			ChatMessageQueryRepository messageQuery,
			RedisRateLimiter rateLimiter,
			PlatformTransactionManager transactions,
			UserModerationService moderation,
			UserUploadService uploads,
			ChatMessageImageRepository imageLinks,
			UserNotificationService notifications
	) {
		this.chatRooms = chatRooms;
		this.lists = lists;
		this.rooms = rooms;
		this.members = members;
		this.events = events;
		this.clock = clock;
		this.accounts = accounts;
		this.messages = messages;
		this.messageQuery = messageQuery;
		this.rateLimiter = rateLimiter;
		this.transactions = new TransactionTemplate(transactions);
		this.moderation = moderation;
		this.uploads = uploads;
		this.imageLinks = imageLinks;
		this.notifications = notifications;
	}

	public void sendMessage(long userId, long roomId, Map<String, Object> payload) {
		if (!chatRooms.canSend(userId, roomId)) {
			throw new StompAuthException("채팅방에 참여할 수 없어요");
		}
		SendCommand command = sendCommand(payload);
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
		List<ChatListRow> rows = lists.page(
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
		if (room.getRoomType() != RoomType.DIRECT) {
			throw new ApiException(404, "NOT_FOUND", "채팅방을 찾지 못했어요");
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
		ChatListSummary summary = lists.summary(user.userId(), clock.instant());
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
		ChatRoom room = rooms.lockById(roomId).orElseThrow(UserChatService::missingRequest);
		members.findActive(roomId, userId).orElseThrow(UserChatService::missingRequest);
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
				? messageQuery.after(user.userId(), roomId, team, start, after, limit + 1)
				: before != null
						? messageQuery.before(user.userId(), roomId, team, start, before, limit + 1)
						: messageQuery.latest(user.userId(), roomId, team, start, limit + 1));
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
				toMessages(rows),
				more,
				capped,
				nextAfter,
				team ? new ChatHistoryLimitResponse(FREE_HISTORY, false) : null
		);
	}

	@Transactional
	public ChatMessageResponse shareCard(AuthenticatedUser principal, long roomId, ShareChatCardRequest request) {
		Participant participant = requireParticipant(principal, roomId);
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
			throw new ApiException(429, "RATE_LIMITED", "공유 요청이 너무 많아요");
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
		if (!messageQuery.visibleTo(user.userId(), roomId, team, historyStart(team), messageId)) {
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
		Participant participant = requireParticipant(principal, roomId);
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
		Participant participant = requireParticipant(principal, roomId);
		ChatMessage message = lockVisible(participant, roomId, messageId);
		// No teams or team_members source exists, so a team owner/admin cannot delete someone else's message.
		if (message.getSenderId() == null
				|| message.getMessageType() == MessageType.SYSTEM
				|| message.getMessageType() == MessageType.PR_EVENT
				|| !participant.account().getId().equals(message.getSenderId())) {
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
			if (!messageQuery.visibleTo(member.getUserId(), roomId, team, historyStart(team), message.getId())) {
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
		return messageQuery.visibleTo(viewerId, roomId, team, historyStart(team), messageId);
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
		if (room.getRoomType() == RoomType.TEAM) {
			reject(current.getId(), roomId, command.clientMessageId(), "TEAM_STATE_UNAVAILABLE", "팀 상태를 확인할 수 없어요", false, null);
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
				.filter(id -> messageQuery.visibleTo(id, roomId, room.getRoomType() == RoomType.TEAM,
						historyStart(room.getRoomType() == RoomType.TEAM), message.getId()))
				.toList();
		long unread = recipientIds.size();
		events.publishEvent(new ChatMessageReady(roomId, toMessage(message, current, unread, imageUrls)));
		boolean team = room.getRoomType() == RoomType.TEAM;
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
					|| messageQuery.visibleTo(memberId, roomId, team, historyStart(team), message.getId());
			if (visible) {
				events.publishEvent(new ChatRoomsChanged(memberId, roomId));
			}
		}
		return true;
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
		if (principal == null) {
			throw new ApiException(401, "UNAUTHORIZED", "로그인이 필요해요");
		}
		return accounts.findById(principal.userId())
				.orElseThrow(() -> new ApiException(401, "UNAUTHORIZED", "로그인이 필요해요"));
	}

	private User requireActive(AuthenticatedUser principal) {
		User account = requireKnown(principal);
		if (account.getStatus() != UserStatus.ACTIVE) {
			throw new ApiException(403, "FORBIDDEN", account.getStatus() == UserStatus.SUSPENDED
					? "정지된 계정은 이 기능을 쓸 수 없어요"
					: "이 기능을 사용할 수 없어요");
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
		Long owner = messageQuery.roomIdOf(messageId);
		if (owner == null || owner != roomId || !messageQuery.visibleTo(
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
		Long owner = messageQuery.roomIdOf(messageId);
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

	private List<ChatMessageResponse> toMessages(List<ChatMessageRow> rows) {
		if (rows.isEmpty()) {
			return List.of();
		}
		Map<Long, List<String>> urls = messageQuery.imageUrls(rows.stream().map(ChatMessageRow::id).toList());
		return rows.stream()
				.map(row -> toMessage(row, urls.getOrDefault(row.id(), List.of())))
				.toList();
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
		if (text.isBlank()) {
			return new SendCommand(clientId, MessageType.IMAGE, "", fileIds);
		}
		return new SendCommand(clientId, MessageType.TEXT, text, fileIds);
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
		return present(payload.get("mentionedUserIds"))
				|| present(payload.get("issueRefs"))
				|| Boolean.TRUE.equals(payload.get("mentionAll"))
				|| foreignType(payload.get("messageType"))
				|| foreignType(payload.get("type"));
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

	private static ChatMessageResponse toMessage(ChatMessageRow row, List<String> imageUrls) {
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
				redacted ? null : row.payload(),
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
		if (!lists.containedInTab(userId, tab, parsed.roomId(), now)) {
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

	private record SendCommand(String clientMessageId, MessageType type, String body, List<Long> fileIds) {
	}
}
