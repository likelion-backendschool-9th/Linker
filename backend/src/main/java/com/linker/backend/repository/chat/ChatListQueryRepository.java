package com.linker.backend.repository.chat;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * One SQL statement computes a page, and one computes the summary.
 * Visible 1:1 messages use the same half-open block period as
 * {@code ModerationService.hidesDirectMessage}. Team rooms skip that predicate.
 */
@Repository
public class ChatListQueryRepository {

	private static final String VISIBLE = """
			(
			  r.room_type = 'TEAM'
			  OR m.sender_id IS NULL
			  OR NOT EXISTS (
			    SELECT 1 FROM user_blocks b
			    WHERE b.blocker_id = :viewer
			      AND b.blocked_id = m.sender_id
			      AND b.created_at <= m.created_at
			      AND (b.unblocked_at IS NULL OR b.unblocked_at > m.created_at)
			  )
			)
			""";

	private static final String FROM_MEMBER = """
			FROM chat_rooms r
			JOIN chat_room_members me
			  ON me.room_id = r.id
			 AND me.user_id = :viewer
			 AND me.left_at IS NULL
			 AND me.hidden_at IS NULL
			""";

	private static final String ROOM_FILTER = """
			(
			  r.room_type = 'TEAM'
			  OR NOT EXISTS (
			    SELECT 1
			    FROM chat_room_members other_member
			    JOIN user_blocks b ON b.unblocked_at IS NULL
			      AND (
			        (b.blocker_id = :viewer AND b.blocked_id = other_member.user_id)
			        OR (b.blocker_id = other_member.user_id AND b.blocked_id = :viewer)
			      )
			    WHERE other_member.room_id = r.id
			      AND other_member.user_id <> :viewer
			  )
			)
			AND (
			  (:tab = 'TEAM' AND r.room_type = 'TEAM')
			  OR (:tab = 'DIRECT' AND r.room_type = 'DIRECT' AND r.dm_status = 'ACCEPTED')
			  OR (
			    :tab = 'REQUEST'
			    AND r.room_type = 'DIRECT'
			    AND r.dm_status = 'REQUESTED'
			    AND r.requester_id <> :viewer
			    AND r.request_expires_at > :now
			  )
			)
			""";

	private static final String PAGE_SQL = """
			SELECT
			  r.id AS room_id,
			  r.room_type,
			  r.request_kind,
			  me.muted,
			  COALESCE(preview.created_at, r.created_at) AS sort_at,
			  preview.id AS preview_id,
			  preview.body AS preview_body,
			  preview.visibility AS preview_visibility,
			  preview.deleted_at AS preview_deleted_at,
			  preview.created_at AS preview_created_at,
			  COALESCE(unread.unread_count, 0) AS unread_count,
			  counterpart.avatar_url,
			  counterpart.display_name,
			  counterpart.username,
			  counterpart.status AS counterpart_status
			%s
			LEFT JOIN LATERAL (
			  SELECT m.id, m.body, m.visibility, m.deleted_at, m.created_at
			  FROM chat_messages m
			  WHERE m.room_id = r.id
			    AND %s
			  ORDER BY m.id DESC
			  LIMIT 1
			) preview ON true
			LEFT JOIN LATERAL (
			  SELECT COUNT(*) AS unread_count
			  FROM chat_messages m
			  WHERE m.room_id = r.id
			    AND (me.last_read_message_id IS NULL OR m.id > me.last_read_message_id)
			    AND (m.sender_id IS NULL OR m.sender_id <> :viewer)
			    AND %s
			) unread ON true
			LEFT JOIN LATERAL (
			  SELECT u.avatar_url, u.display_name, u.username, u.status
			  FROM chat_room_members other_member
			  JOIN users u ON u.id = other_member.user_id
			  WHERE other_member.room_id = r.id
			    AND other_member.user_id <> :viewer
			    AND r.room_type = 'DIRECT'
			  ORDER BY other_member.user_id
			  LIMIT 1
			) counterpart ON true
			WHERE %s
			AND (
			  CAST(:cursor_sort AS timestamptz) IS NULL
			  OR COALESCE(preview.created_at, r.created_at) < CAST(:cursor_sort AS timestamptz)
			  OR (
			    COALESCE(preview.created_at, r.created_at) = CAST(:cursor_sort AS timestamptz)
			    AND r.id < :cursor_room_id
			  )
			)
			ORDER BY COALESCE(preview.created_at, r.created_at) DESC, r.id DESC
			LIMIT :limit
			""".formatted(FROM_MEMBER, VISIBLE, VISIBLE, ROOM_FILTER);

	private static final String SUMMARY_SQL = """
			SELECT
			  COALESCE(SUM(unread.unread_count) FILTER (WHERE r.room_type = 'TEAM'), 0) AS team_unread,
			  COALESCE(SUM(unread.unread_count) FILTER (WHERE r.room_type = 'DIRECT' AND r.dm_status = 'ACCEPTED'), 0) AS direct_unread,
			  COALESCE(SUM(unread.unread_count) FILTER (
			    WHERE r.room_type = 'DIRECT' AND r.dm_status = 'REQUESTED'
			      AND r.requester_id <> :viewer AND r.request_expires_at > :now
			  ), 0) AS request_unread,
			  COUNT(*) FILTER (
			    WHERE r.room_type = 'DIRECT' AND r.dm_status = 'REQUESTED'
			      AND r.requester_id <> :viewer AND r.request_expires_at > :now
			  ) AS request_count
			FROM chat_rooms r
			JOIN chat_room_members me
			  ON me.room_id = r.id
			 AND me.user_id = :viewer
			 AND me.left_at IS NULL
			 AND me.hidden_at IS NULL
			LEFT JOIN LATERAL (
			  SELECT COUNT(*) AS unread_count
			  FROM chat_messages m
			  WHERE m.room_id = r.id
			    AND (me.last_read_message_id IS NULL OR m.id > me.last_read_message_id)
			    AND (m.sender_id IS NULL OR m.sender_id <> :viewer)
			    AND %s
			) unread ON true
			WHERE (
			  r.room_type = 'TEAM'
			  OR NOT EXISTS (
			    SELECT 1
			    FROM chat_room_members other_member
			    JOIN user_blocks b ON b.unblocked_at IS NULL
			      AND (
			        (b.blocker_id = :viewer AND b.blocked_id = other_member.user_id)
			        OR (b.blocker_id = other_member.user_id AND b.blocked_id = :viewer)
			      )
			    WHERE other_member.room_id = r.id
			      AND other_member.user_id <> :viewer
			  )
			)
			""".formatted(VISIBLE);

	private static final String IN_TAB_SQL = """
			SELECT COUNT(*)
			%s
			WHERE %s
			AND r.id = :room_id
			""".formatted(FROM_MEMBER, ROOM_FILTER);

	private final NamedParameterJdbcTemplate jdbc;

	public ChatListQueryRepository(NamedParameterJdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	public List<ChatListRow> page(long viewerId, String tab, Instant now, Instant cursorSort, Long cursorRoomId, int limit) {
		MapSqlParameterSource params = base(viewerId, tab, now)
				.addValue("cursor_sort", cursorSort == null ? null : Timestamp.from(cursorSort))
				.addValue("cursor_room_id", cursorRoomId == null ? 0L : cursorRoomId)
				.addValue("limit", limit);
		return jdbc.query(PAGE_SQL, params, (rs, rowNum) -> mapRow(rs));
	}

	public ChatListSummary summary(long viewerId, Instant now) {
		MapSqlParameterSource params = new MapSqlParameterSource()
				.addValue("viewer", viewerId)
				.addValue("now", Timestamp.from(now));
		return jdbc.queryForObject(SUMMARY_SQL, params, (rs, rowNum) -> new ChatListSummary(
				rs.getLong("team_unread"),
				rs.getLong("direct_unread"),
				rs.getLong("request_unread"),
				rs.getLong("request_count")
		));
	}

	public boolean containedInTab(long viewerId, String tab, long roomId, Instant now) {
		Long count = jdbc.queryForObject(IN_TAB_SQL, base(viewerId, tab, now).addValue("room_id", roomId), Long.class);
		return count != null && count > 0;
	}

	private static MapSqlParameterSource base(long viewerId, String tab, Instant now) {
		return new MapSqlParameterSource()
				.addValue("viewer", viewerId)
				.addValue("tab", tab)
				.addValue("now", Timestamp.from(now));
	}

	private static ChatListRow mapRow(ResultSet rs) throws SQLException {
		Long previewId = rs.getObject("preview_id", Long.class);
		return new ChatListRow(
				rs.getLong("room_id"),
				rs.getString("room_type"),
				rs.getString("request_kind"),
				rs.getBoolean("muted"),
				rs.getTimestamp("sort_at").toInstant(),
				previewId == null ? null : rs.getString("preview_body"),
				previewId == null ? null : rs.getString("preview_visibility"),
				previewId == null ? null : instant(rs, "preview_deleted_at"),
				previewId == null ? null : instant(rs, "preview_created_at"),
				rs.getLong("unread_count"),
				rs.getString("avatar_url"),
				rs.getString("display_name"),
				rs.getString("username"),
				rs.getString("counterpart_status")
		);
	}

	private static Instant instant(ResultSet rs, String column) throws SQLException {
		Timestamp timestamp = rs.getTimestamp(column);
		return timestamp == null ? null : timestamp.toInstant();
	}

	public record ChatListRow(
			long roomId,
			String roomType,
			String requestKind,
			boolean muted,
			Instant sortAt,
			String previewBody,
			String previewVisibility,
			Instant previewDeletedAt,
			Instant previewCreatedAt,
			long unreadCount,
			String avatarUrl,
			String displayName,
			String username,
			String counterpartStatus
	) {
	}

	public record ChatListSummary(long teamUnread, long directUnread, long requestUnread, long requestCount) {
	}
}
