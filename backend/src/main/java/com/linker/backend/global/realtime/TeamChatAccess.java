package com.linker.backend.global.realtime;

import java.util.List;

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
					select t.id, t.name, t.status
					from teams t join team_members m on m.team_id=t.id
					where t.id=? and m.user_id=? and m.left_at is null
					  and t.status not in ('ARCHIVED','DELETED')
					""", (rs, index) -> new TeamView(rs.getLong(1), rs.getString(2), rs.getString(3)), teamId, userId);
			return rows.isEmpty() ? null : rows.getFirst();
		}
		catch (RuntimeException exception) {
			return null;
		}
	}

	public boolean writableBy(long userId, long teamId) {
		TeamView team = readableBy(userId, teamId);
		return team != null && "ACTIVE".equals(team.status());
	}

	public record TeamView(long id, String name, String status) {
	}
}
