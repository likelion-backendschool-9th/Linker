package com.linker.backend.repository.chat;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Reads recruiting direct rooms. Page 17 owns creating them. */
@Repository
public class RecruitingOfferQuery {

	private final JdbcTemplate jdbc;

	public RecruitingOfferQuery(JdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	public List<OfferRow> list(long recruiterId) {
		return jdbc.query("""
				select room.id, room.dm_status, room.created_at, room.request_expires_at, room.responded_at,
				       developer.id as developer_id, developer.username, developer.display_name, developer.avatar_url,
				       developer.status as developer_status, developer.deleted_at, developer.job_seeking_status,
				       first_message.body as first_body, first_message.created_at as first_at,
				       (select string_agg(tag.name, ',' order by tag.sort_order, tag.id)
				        from user_tech_tags selected
				        join tech_tags tag on tag.id = selected.tag_id
				        where selected.user_id = developer.id) as tech_stack
				from chat_rooms room
				left join chat_room_members other
				  on other.room_id = room.id and other.user_id <> room.requester_id and other.left_at is null
				left join users developer on developer.id = other.user_id
				left join lateral (
				  select body, created_at
				  from chat_messages message
				  where message.room_id = room.id
				    and message.sender_id = room.requester_id
				    and message.message_type = 'TEXT'
				  order by message.id
				  limit 1
				) first_message on true
				where room.requester_id = ?
				  and room.room_type = 'DIRECT'
				  and room.request_kind = 'RECRUITING'
				order by room.created_at desc, room.id desc
				""", (row, number) -> new OfferRow(
				row.getLong("id"),
				row.getString("dm_status"),
				instant(row.getTimestamp("created_at")),
				instant(row.getTimestamp("request_expires_at")),
				instant(row.getTimestamp("responded_at")),
				row.getObject("developer_id", Long.class),
				row.getString("username"),
				row.getString("display_name"),
				row.getString("avatar_url"),
				row.getString("developer_status"),
				instant(row.getTimestamp("deleted_at")),
				row.getString("job_seeking_status"),
				row.getString("first_body"),
				instant(row.getTimestamp("first_at")),
				tags(row.getString("tech_stack"))
		), recruiterId);
	}

	public int sentSince(long recruiterId, Instant start) {
		Integer count = jdbc.queryForObject("""
				select count(*) from chat_rooms
				where requester_id = ? and room_type = 'DIRECT' and request_kind = 'RECRUITING' and created_at >= ?
				""", Integer.class, recruiterId, Timestamp.from(start));
		return count == null ? 0 : count;
	}

	public OfferMessage firstMessage(long recruiterId, long roomId) {
		List<OfferMessage> rows = jdbc.query("""
				select message.body, message.created_at
				from chat_rooms room
				left join lateral (
				  select body, created_at
				  from chat_messages message
				  where message.room_id = room.id
				    and message.sender_id = room.requester_id
				    and message.message_type = 'TEXT'
				  order by message.id
				  limit 1
				) message on true
				where room.id = ? and room.requester_id = ? and room.request_kind = 'RECRUITING'
				""", (row, number) -> new OfferMessage(row.getString("body"), instant(row.getTimestamp("created_at"))),
				roomId, recruiterId);
		return rows.isEmpty() ? null : rows.get(0);
	}

	private static Instant instant(Timestamp value) {
		return value == null ? null : value.toInstant();
	}

	private static List<String> tags(String stacked) {
		if (stacked == null || stacked.isBlank()) {
			return List.of();
		}
		return Arrays.stream(stacked.split(",")).limit(3).toList();
	}

	public record OfferRow(
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

	public record OfferMessage(String body, Instant sentAt) {
	}
}
