package com.linker.backend.repository.profile;

import java.util.List;

import com.linker.backend.dto.account.response.PublicProfileResponse;
import com.linker.backend.dto.account.response.PublicTeamsResponse;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Reads team membership and completion rows when those tables exist.
 * Page 08 and page 09 own the migrations, so a missing table stays an empty result.
 */
@Repository
public class PublicProfileQuery {

	private final JdbcTemplate jdbc;

	public PublicProfileQuery(JdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	public PublicProfileResponse.Completion completion(long userId) {
		if (!ready("completion_records", "user_id", "result", "assigned_issue_count", "done_issue_count")) {
			return new PublicProfileResponse.Completion(0, 0);
		}
		return jdbc.queryForObject("""
				select count(*) filter (where result = 'COMPLETED'),
				       coalesce(sum(done_issue_count), 0),
				       coalesce(sum(assigned_issue_count), 0)
				from completion_records
				where user_id = ?
				""", (row, number) -> {
			long assigned = row.getLong(3);
			double rate = assigned == 0 ? 0 : row.getLong(2) / (double) assigned;
			return new PublicProfileResponse.Completion(row.getInt(1), rate);
		}, userId);
	}

	public List<PublicTeamsResponse.TeamItem> teams(long userId) {
		if (!ready("teams", "id", "name", "avatar_url", "status")
				|| !ready("team_members", "team_id", "user_id", "left_at")) {
			return List.of();
		}
		return jdbc.query("""
				select t.id, t.name, t.avatar_url, t.status
				from teams t
				join team_members member on member.team_id = t.id
				where member.user_id = ?
				  and member.left_at is null
				  and t.status in ('ACTIVE', 'COMPLETED')
				order by t.id
				""", (row, number) -> new PublicTeamsResponse.TeamItem(
				row.getLong("id"),
				row.getString("name"),
				row.getString("avatar_url"),
				row.getString("status")), userId);
	}

	private boolean ready(String table, String... columns) {
		Boolean exists = jdbc.queryForObject(
				"select to_regclass('public." + table + "') is not null", Boolean.class);
		if (!Boolean.TRUE.equals(exists)) {
			return false;
		}
		for (String column : columns) {
			Integer count = jdbc.queryForObject("""
					select count(*) from information_schema.columns
					where table_schema = 'public' and table_name = ? and column_name = ?
					""", Integer.class, table, column);
			if (count == null || count == 0) {
				return false;
			}
		}
		return true;
	}
}
