package com.linker.backend.service.user;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.linker.backend.dto.chat.event.ChatMessageReady;
import com.linker.backend.dto.chat.event.ChatRoomsChanged;
import com.linker.backend.dto.chat.event.ChatSendAccepted;
import com.linker.backend.dto.chat.event.ChatSendRejected;
import com.linker.backend.dto.chat.request.MarkChatReadRequest;
import com.linker.backend.dto.chat.response.AcceptChatRequestResponse;
import com.linker.backend.dto.chat.response.ChatCounterpartResponse;
import com.linker.backend.dto.chat.response.ChatHistoryLimitResponse;
import com.linker.backend.dto.chat.response.ChatLastMessageResponse;
import com.linker.backend.dto.chat.response.ChatMemberResponse;
import com.linker.backend.dto.chat.response.ChatMessagePageResponse;
import com.linker.backend.dto.chat.response.ChatMessageResponse;
import com.linker.backend.dto.chat.response.ChatRoomItemResponse;
import com.linker.backend.dto.chat.response.ChatRoomPageResponse;
import com.linker.backend.dto.chat.response.UnreadSummaryResponse;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.entity.chat.ChatMessage;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.entity.chat.DmStatus;
import com.linker.backend.entity.chat.MessageType;
import com.linker.backend.entity.chat.RoomType;
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
import com.linker.backend.repository.chat.ChatMessageQueryRepository;
import com.linker.backend.repository.chat.ChatMessageQueryRepository.ChatMessageRow;
import com.linker.backend.repository.chat.ChatMessageRepository;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.chat.ChatRoomRepository;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Paired entry for {@link com.linker.backend.controller.user.UserChatController}.
 * Sending a message stays closed until page 17. List calculations read rows that tests or a
 * later writer insert. This class does not invent team names, company names, or message text.
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
			UserModerationService moderation
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
	}

	public void sendMessage(long userId, long roomId, Map<String, Object> payload) {
		if (!chatRooms.canSend(userId, roomId)) {
			throw new StompAuthException("채팅방에 참여할 수 없어요");
		}
		TextCommand command = textCommand(payload);
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
				rows.stream().map(UserChatService::toMessage).toList(),
				more,
				capped,
				nextAfter,
				team ? new ChatHistoryLimitResponse(FREE_HISTORY, false) : null
		);
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
		events.publishEvent(new ChatRoomsChanged(user.userId(), roomId));
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

	private boolean storeNewText(User account, long roomId, TextCommand command) {
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
		ChatMessage message = messages.saveAndFlush(ChatMessage.clientText(room, current.getId(), command.text(), command.clientMessageId()));
		messages.assignCreatedAt(message.getId(), createdAt);
		message.alignCreatedAt(createdAt);
		if (!message.getRoom().getId().equals(room.getId())) {
			throw new IllegalStateException("message room mismatch");
		}
		room.markLastMessage(message.getId(), createdAt);
		long unread = members.findActiveUserIds(roomId).stream().filter(id -> id != current.getId()).count();
		events.publishEvent(new ChatMessageReady(roomId, toMessage(message, current, unread)));
		boolean team = room.getRoomType() == RoomType.TEAM;
		for (Long memberId : members.findActiveUserIds(roomId)) {
			boolean visible = memberId == current.getId()
					|| messageQuery.visibleTo(memberId, roomId, team, historyStart(team), message.getId());
			if (visible) {
				events.publishEvent(new ChatRoomsChanged(memberId, roomId));
			}
		}
		return true;
	}

	private void confirmStored(long userId, long roomId, TextCommand command) {
		ChatMessage existing = messages.findBySenderIdAndClientMessageId(userId, command.clientMessageId()).orElse(null);
		if (existing == null || !sameRequest(existing, roomId, command)) {
			reject(userId, roomId, command.clientMessageId(), "CONFLICT", "이미 사용한 메시지 식별자예요", false, null);
			return;
		}
		events.publishEvent(new ChatSendAccepted(userId, roomId, command.clientMessageId(), existing.getId()));
	}

	private static boolean sameRequest(ChatMessage existing, long roomId, TextCommand command) {
		return existing.getMessageType() == MessageType.TEXT
				&& command.text().equals(existing.getBody())
				&& existing.getRoom().getId().equals(roomId);
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

	private static TextCommand textCommand(Map<String, Object> payload) {
		if (payload == null || unsupportedAttachment(payload)) {
			throw new StompAuthException(payload == null || !unsupportedAttachment(payload)
					? "메시지 내용을 확인해 주세요" : "텍스트 메시지만 보낼 수 있어요");
		}
		Object textValue = payload.get("text");
		if (!(textValue instanceof String text) || text.isBlank()) {
			throw new StompAuthException("메시지 내용을 확인해 주세요");
		}
		if (text.codePointCount(0, text.length()) > PlanLimits.CHAT_MESSAGE_MAX_CHARS) {
			throw new StompAuthException("메시지는 2000자까지 쓸 수 있어요");
		}
		Object rawId = payload.get("clientMessageId");
		if (!(rawId instanceof String clientId) || !canonicalUuid(clientId)) {
			throw new StompAuthException("메시지 식별자를 확인해 주세요");
		}
		return new TextCommand(clientId, text);
	}

	private static boolean unsupportedAttachment(Map<String, Object> payload) {
		return present(payload.get("fileIds"))
				|| present(payload.get("mentionedUserIds"))
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
		return value instanceof String text && !text.isBlank() && !"TEXT".equals(text);
	}

	private static boolean canonicalUuid(String raw) {
		try {
			return raw.equals(UUID.fromString(raw).toString());
		}
		catch (IllegalArgumentException exception) {
			return false;
		}
	}

	private static ChatMessageResponse toMessage(ChatMessage message, User sender, long unreadCount) {
		return new ChatMessageResponse(
				message.getId(),
				message.getRoom().getId(),
				unreadCount,
				message.getClientMessageId(),
				new ChatMemberResponse(sender.getId(), sender.getUsername(), sender.visibleName(), sender.getAvatarUrl()),
				message.getMessageType().name(),
				message.getBody(),
				List.of(),
				null,
				message.getCreatedAt(),
				null,
				null,
				"VISIBLE"
		);
	}

	private static ChatMessageResponse toMessage(ChatMessageRow row) {
		String text = row.deletedAt() != null ? DELETED_PREVIEW : "HIDDEN".equals(row.visibility()) ? HIDDEN_PREVIEW : row.body();
		ChatMemberResponse sender = row.senderId() == null ? null : new ChatMemberResponse(
				row.senderId(),
				row.username(),
				visibleName(row.displayName(), row.username()),
				row.avatarUrl()
		);
		return new ChatMessageResponse(
				row.id(),
				row.roomId(),
				row.unreadCount(),
				row.clientMessageId(),
				sender,
				row.type(),
				text,
				List.of(),
				null,
				row.createdAt(),
				null,
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
		String title = team ? null : visibleName(row.displayName(), row.username());
		ChatCounterpartResponse counterpart = team || row.username() == null
				? null
				: new ChatCounterpartResponse(row.avatarUrl());
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

	private record TextCommand(String clientMessageId, String text) {
	}
}
