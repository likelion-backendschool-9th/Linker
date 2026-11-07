package com.linker.backend.global.realtime;

import java.util.List;

import com.linker.backend.dto.chat.response.ChatMemberResponse;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Reads the B-owned team schema for chat only. Missing schema never grants access. */
@Component
public class TeamChatAccess {
	private final JdbcTemplate jdbc;

	public TeamChatAccess(JdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	public TeamView readableBy(long userId, long teamId) {
		try {
			List<TeamView> rows = jdbc.query("""
					select t.id, t.name, t.status, m.role
					from teams t join team_members m on m.team_id=t.id
					where t.id=? and m.user_id=? and m.left_at is null
					  and t.status <> 'DELETED'
					""", (rs, index) -> new TeamView(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4)), teamId, userId);
			return rows.isEmpty() ? null : rows.getFirst();
		}
		catch (RuntimeException exception) {
			return null;
		}
	}

	public boolean writableBy(long userId, long teamId) {
		TeamView team = readableBy(userId, teamId);
		return team != null && ("ACTIVE".equals(team.status()) || "COMPLETED".equals(team.status()));
	}

	public boolean canModerate(long userId, long teamId) {
		TeamView team = readableBy(userId, teamId);
		return team != null && ("OWNER".equals(team.role()) || "ADMIN".equals(team.role()));
	}

	public List<ChatMemberResponse> mentionCandidates(long viewerId, long teamId) {
		if (readableBy(viewerId, teamId) == null) {
			return List.of();
		}
		try {
			return jdbc.query("""
					select u.id, u.username, coalesce(nullif(u.display_name, ''), u.username), u.avatar_url
					from team_members m join users u on u.id=m.user_id
					where m.team_id=? and m.left_at is null
					  and u.deleted_at is null and u.status='ACTIVE'
					order by lower(u.username), u.id
					""", (rs, index) -> new ChatMemberResponse(
					rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4)
			), teamId);
		}
		catch (RuntimeException exception) {
			return List.of();
		}
	}

	public record TeamView(long id, String name, String status, String role) {
	}
}
