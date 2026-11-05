package com.linker.backend.service.user;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import com.linker.backend.dto.chat.event.ChatRoomsChanged;
import com.linker.backend.dto.chat.response.AcceptChatRequestResponse;
import com.linker.backend.dto.chat.response.ChatCounterpartResponse;
import com.linker.backend.dto.chat.response.ChatLastMessageResponse;
import com.linker.backend.dto.chat.response.ChatRoomItemResponse;
import com.linker.backend.dto.chat.response.ChatRoomPageResponse;
import com.linker.backend.dto.chat.response.UnreadSummaryResponse;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.DmStatus;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.realtime.ChatRoomAccess;
import com.linker.backend.global.realtime.StompAuthException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.chat.ChatListQuery;
import com.linker.backend.repository.chat.ChatListQuery.ChatListRow;
import com.linker.backend.repository.chat.ChatListQuery.ChatListSummary;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.chat.ChatRoomRepository;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Paired entry for {@link com.linker.backend.controller.user.UserChatController}.
 * Sending a message stays closed until page 17. List calculations read rows that tests or a
 * later writer insert. This class does not invent team names, company names, or message text.
 */
@Service
public class UserChatService {

	/** Technical page size, not a Policy limit. */
	static final int PAGE_SIZE = 20;

	/** Context binding only. The token is not an authenticator or an integrity seal. */
	private static final int CURSOR_VERSION = 1;
	private static final int MAX_CURSOR_LENGTH = 160;

	static final String DELETED_PREVIEW = "삭제된 메시지입니다";
	static final String HIDDEN_PREVIEW = "운영 정책에 따라 숨겨진 메시지예요";

	private final ChatRoomAccess chatRooms;
	private final ChatListQuery lists;
	private final ChatRoomRepository rooms;
	private final ChatRoomMemberRepository members;
	private final ApplicationEventPublisher events;
	private final Clock clock;

	public UserChatService(
			ChatRoomAccess chatRooms,
			ChatListQuery lists,
			ChatRoomRepository rooms,
			ChatRoomMemberRepository members,
			ApplicationEventPublisher events,
			Clock clock
	) {
		this.chatRooms = chatRooms;
		this.lists = lists;
		this.rooms = rooms;
		this.members = members;
		this.events = events;
		this.clock = clock;
	}

	public void sendMessage(long userId, long roomId, Map<String, Object> payload) {
		if (!chatRooms.canSend(userId, roomId)) {
			throw new StompAuthException("채팅방에 참여할 수 없어요");
		}
		if (payload == null || payload.isEmpty()) {
			throw new StompAuthException("메시지 내용을 확인해 주세요");
		}
		throw new StompAuthException("채팅 전송은 아직 준비 중이에요");
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
}
