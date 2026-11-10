package com.linker.backend.repository.chat;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import com.linker.backend.dto.chat.response.ChatShareCardResponse;

/**
 * History rows for one member. Block periods match {@code ModerationService.hidesDirectMessage}.
 * Deleted and hidden rows stay in the page; the service replaces their text.
 */
public interface ChatMessageRepositoryCustom {

	List<ChatMessageRow> latest(long viewerId, long roomId, boolean team, Instant historyStart, int limit);

	List<ChatMessageRow> before(long viewerId, long roomId, boolean team, Instant historyStart, long before, int limit);

	List<ChatMessageRow> after(long viewerId, long roomId, boolean team, Instant historyStart, long after, int limit);

	boolean visibleTo(long viewerId, long roomId, boolean team, Instant historyStart, long messageId);

	/** Visible text messages containing the keyword, newest first. */
	List<ChatMessageRow> search(long roomId, Instant historyStart, String keyword);

	/**
	 * Server URLs in {@code sort_order}. Callers drop these for deleted, hidden, and not-visible rows.
	 */
	Map<Long, List<String>> imageUrls(Collection<Long> messageIds);

	/** Card for a shared post, recruit post or profile; "unavailable" when the viewer may not see the target. */
	ChatShareCardResponse resolveShareCard(long viewerId, String targetType, long targetId);

	record ChatMessageRow(
			long id,
			long roomId,
			long unreadCount,
			String clientMessageId,
			Long senderId,
			String username,
			String displayName,
			String avatarUrl,
			String senderStatus,
			String type,
			String body,
			String payload,
			String visibility,
			Instant deletedAt,
			Instant createdAt,
			Instant editedAt,
			Instant updatedAt
	) {
	}
}
