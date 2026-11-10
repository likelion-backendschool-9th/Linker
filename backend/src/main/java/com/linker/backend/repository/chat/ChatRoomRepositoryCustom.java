package com.linker.backend.repository.chat;

import java.time.Instant;
import java.util.List;
import com.linker.backend.dto.chat.response.ChatShareTargetResponse;

/**
 * Room-centred reads that join members, messages, users and blocks: the chat room list
 * (page, summary, tab membership) and the recruiter's offer rooms.
 */
public interface ChatRoomRepositoryCustom {

	List<ChatShareTargetResponse> shareTargets(long viewerId, boolean developer, String search);

	boolean shareableBy(long viewerId, boolean developer, long roomId);

	/**
	 * One page of the viewer's rooms. Visible 1:1 messages use the same half-open block period as
	 * {@code ModerationService.hidesDirectMessage}. Team rooms skip that predicate.
	 */
	List<ChatListRow> listPage(long viewerId, String tab, Instant now, Instant cursorSort, Long cursorRoomId, int limit);

	ChatListSummary listSummary(long viewerId, Instant now);

	boolean containedInTab(long viewerId, String tab, long roomId, Instant now);

	/** Recruiting direct rooms opened by the recruiter, newest first. Page 17 owns creating them. */
	List<OfferRow> recruitingOffers(long recruiterId);

	/**
	 * The recruiter's first text message in an offer room. Returns {@code null} when the room is not
	 * one of the recruiter's offers, and a message with null fields when nothing was sent yet.
	 */
	OfferMessage firstOfferMessage(long recruiterId, long roomId);

	record ChatListRow(
			long roomId,
			String roomType,
			String requestKind,
			boolean muted,
			Instant sortAt,
			Long previewId,
			String previewBody,
			String previewVisibility,
			Instant previewDeletedAt,
			Instant previewCreatedAt,
			long unreadCount,
			String avatarUrl,
			String displayName,
			String username,
			String counterpartStatus,
			Long teamId,
			String teamName,
			String teamAvatarUrl
	) {
	}

	record ChatListSummary(long teamUnread, long directUnread, long requestUnread, long requestCount) {
	}

	record OfferRow(
			long roomId,
			String dmStatus,
			Instant createdAt,
			Instant requestExpiresAt,
			Instant respondedAt,
			Long developerId,
			String username,
			String displayName,
			String avatarUrl,
			String developerStatus,
			Instant developerDeletedAt,
			String jobSeekingStatus,
			String firstBody,
			Instant firstAt,
			List<String> techStack
	) {
	}

	record OfferMessage(String body, Instant sentAt) {
	}
}
