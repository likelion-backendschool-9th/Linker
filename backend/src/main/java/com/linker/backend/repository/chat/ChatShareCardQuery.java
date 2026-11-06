package com.linker.backend.repository.chat;

import java.util.List;

import com.linker.backend.dto.chat.response.ChatShareCardResponse;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ChatShareCardQuery {

	private final JdbcTemplate jdbc;

	public ChatShareCardQuery(JdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	public ChatShareCardResponse resolve(long viewerId, String targetType, long targetId) {
		return switch (targetType) {
			case "POST" -> post(viewerId, targetId);
			case "RECRUIT_POST" -> recruit(viewerId, targetId);
			case "PROFILE" -> profile(viewerId, targetId);
			default -> ChatShareCardResponse.unavailable(targetType, targetId);
		};
	}

	private ChatShareCardResponse post(long viewerId, long id) {
		List<ChatShareCardResponse> rows = jdbc.query("""
				select p.id, p.summary,
				       (select f.url from post_images pi join uploaded_files f on f.id=pi.file_id
				        where pi.post_id=p.id order by pi.sort_order, pi.id limit 1) image_url
				from posts p join users u on u.id=p.author_id
				where p.id=? and p.deleted_at is null and p.visibility='VISIBLE'
				  and u.deleted_at is null and u.status<>'DELETED'
				  and not exists (select 1 from user_blocks b where b.unblocked_at is null and
				    ((b.blocker_id=? and b.blocked_id=p.author_id) or (b.blocker_id=p.author_id and b.blocked_id=?)))
				""", (rs, n) -> new ChatShareCardResponse(
				"POST", rs.getLong("id"), rs.getString("summary"), null,
				rs.getString("image_url"), "/posts/" + rs.getLong("id") + "?from=chat_share", true
		), id, viewerId, viewerId);
		return rows.isEmpty() ? ChatShareCardResponse.unavailable("POST", id) : rows.get(0);
	}

	private ChatShareCardResponse recruit(long viewerId, long id) {
		List<ChatShareCardResponse> rows = jdbc.query("""
				select p.id, p.title, p.description
				from recruit_posts p join users u on u.id=p.author_id
				where p.id=? and p.deleted_at is null and p.visibility='VISIBLE'
				  and u.deleted_at is null and u.status<>'DELETED'
				  and not exists (select 1 from user_blocks b where b.unblocked_at is null and
				    ((b.blocker_id=? and b.blocked_id=p.author_id) or (b.blocker_id=p.author_id and b.blocked_id=?)))
				""", (rs, n) -> new ChatShareCardResponse(
				"RECRUIT_POST", rs.getLong("id"), rs.getString("title"), rs.getString("description"),
				null, "/recruits/" + rs.getLong("id") + "?from=chat_share", true
		), id, viewerId, viewerId);
		return rows.isEmpty() ? ChatShareCardResponse.unavailable("RECRUIT_POST", id) : rows.get(0);
	}

	private ChatShareCardResponse profile(long viewerId, long id) {
		List<ChatShareCardResponse> rows = jdbc.query("""
				select u.id, u.username, coalesce(u.display_name, u.username) display_name, u.avatar_url
				from users u
				where u.id=? and u.deleted_at is null and u.status<>'DELETED'
				  and not exists (select 1 from user_blocks b where b.unblocked_at is null and
				    ((b.blocker_id=? and b.blocked_id=u.id) or (b.blocker_id=u.id and b.blocked_id=?)))
				""", (rs, n) -> new ChatShareCardResponse(
				"PROFILE", rs.getLong("id"), rs.getString("display_name"), "@" + rs.getString("username"),
				rs.getString("avatar_url"), "/users/" + rs.getString("username"), true
		), id, viewerId, viewerId);
		return rows.isEmpty() ? ChatShareCardResponse.unavailable("PROFILE", id) : rows.get(0);
	}
}
