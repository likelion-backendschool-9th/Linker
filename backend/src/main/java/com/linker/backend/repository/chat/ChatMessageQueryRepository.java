package com.linker.backend.repository.chat;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Collections;
import java.util.List;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * History rows for one member. Block periods match {@code UserModerationService.hidesDirectMessage}.
 * Deleted and hidden rows stay in the page; the service replaces their text.
 */
@Repository
public class ChatMessageQueryRepository {

	private static final String SELECT = """
			SELECT
			  m.id, m.room_id, m.sender_id, m.message_type, m.body, m.visibility, m.deleted_at,
			  m.created_at, m.client_message_id,
			  u.username, u.display_name, u.avatar_url,
			  (
			    SELECT COUNT(*)
			    FROM chat_room_members other_member
			    WHERE other_member.room_id = m.room_id
			      AND other_member.left_at IS NULL
			      AND (m.sender_id IS NULL OR other_member.user_id <> m.sender_id)
			      AND (
			        other_member.last_read_message_id IS NULL
			        OR other_member.last_read_message_id < m.id
			      )
			  ) AS unread_count
			FROM chat_messages m
			LEFT JOIN users u ON u.id = m.sender_id
			WHERE m.room_id = :room
			  AND (CAST(:history_start AS timestamptz) IS NULL OR m.created_at >= CAST(:history_start AS timestamptz))
			  AND (
			    :team = true
			    OR m.sender_id IS NULL
			    OR m.sender_id = :viewer
			    OR NOT EXISTS (
			      SELECT 1 FROM user_blocks b
			      WHERE b.blocker_id = :viewer
			        AND b.blocked_id = m.sender_id
			        AND b.created_at <= m.created_at
			        AND (b.unblocked_at IS NULL OR b.unblocked_at > m.created_at)
			    )
			  )
			""";

	private final NamedParameterJdbcTemplate jdbc;

	public ChatMessageQueryRepository(NamedParameterJdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	public Long roomIdOf(long messageId) {
		List<Long> ids = jdbc.query(
				"SELECT room_id FROM chat_messages WHERE id = :id",
				new MapSqlParameterSource("id", messageId),
				(rs, rowNum) -> rs.getLong("room_id")
		);
		return ids.isEmpty() ? null : ids.get(0);
	}

	public List<ChatMessageRow> latest(long viewerId, long roomId, boolean team, Instant historyStart, int limit) {
		String sql = SELECT + " ORDER BY m.id DESC LIMIT :limit";
		List<ChatMessageRow> rows = jdbc.query(sql, params(viewerId, roomId, team, historyStart, null).addValue("limit", limit), this::map);
		Collections.reverse(rows);
		return rows;
	}

	public List<ChatMessageRow> before(long viewerId, long roomId, boolean team, Instant historyStart, long before, int limit) {
		String sql = SELECT + " AND m.id < :anchor ORDER BY m.id DESC LIMIT :limit";
		List<ChatMessageRow> rows = jdbc.query(
				sql,
				params(viewerId, roomId, team, historyStart, before).addValue("limit", limit),
				this::map
		);
		Collections.reverse(rows);
		return rows;
	}

	public List<ChatMessageRow> after(long viewerId, long roomId, boolean team, Instant historyStart, long after, int limit) {
		String sql = SELECT + " AND m.id > :anchor ORDER BY m.id ASC LIMIT :limit";
		return jdbc.query(sql, params(viewerId, roomId, team, historyStart, after).addValue("limit", limit), this::map);
	}

	public boolean visibleTo(long viewerId, long roomId, boolean team, Instant historyStart, long messageId) {
		String sql = SELECT + " AND m.id = :anchor";
		List<ChatMessageRow> rows = jdbc.query(sql, params(viewerId, roomId, team, historyStart, messageId), this::map);
		return !rows.isEmpty();
	}

	private static MapSqlParameterSource params(long viewerId, long roomId, boolean team, Instant historyStart, Long anchor) {
		return new MapSqlParameterSource()
				.addValue("viewer", viewerId)
				.addValue("room", roomId)
				.addValue("team", team)
				.addValue("history_start", historyStart == null ? null : Timestamp.from(historyStart))
				.addValue("anchor", anchor);
	}

	private ChatMessageRow map(ResultSet rs, int rowNum) throws SQLException {
		Long senderId = rs.getObject("sender_id", Long.class);
		Timestamp deleted = rs.getTimestamp("deleted_at");
		return new ChatMessageRow(
				rs.getLong("id"),
				rs.getLong("room_id"),
				rs.getLong("unread_count"),
				rs.getString("client_message_id"),
				senderId,
				rs.getString("username"),
				rs.getString("display_name"),
				rs.getString("avatar_url"),
				rs.getString("message_type"),
				rs.getString("body"),
				rs.getString("visibility"),
				deleted == null ? null : deleted.toInstant(),
				rs.getTimestamp("created_at").toInstant()
		);
	}

	public record ChatMessageRow(
			long id,
			long roomId,
			long unreadCount,
			String clientMessageId,
			Long senderId,
			String username,
			String displayName,
			String avatarUrl,
			String type,
			String body,
			String visibility,
			Instant deletedAt,
			Instant createdAt
	) {
	}
}
