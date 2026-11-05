package com.linker.backend.repository.team;

import java.util.List;

import com.linker.backend.service.user.OwnedTeamLookup;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class OwnedTeamQuery implements OwnedTeamLookup {

	private final JdbcTemplate jdbc;

	public OwnedTeamQuery(JdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	@Override
	public List<OwnedTeam> ownedBy(long userId) {
		if (!tablesReady()) {
			return List.of();
		}
		return jdbc.query("""
				SELECT t.id, t.name
				FROM team_members m
				JOIN teams t ON t.id = m.team_id
				WHERE m.user_id = ?
				  AND m.role = 'OWNER'
				  AND m.left_at IS NULL
				ORDER BY t.id
				""", (rs, row) -> new OwnedTeam(rs.getLong("id"), rs.getString("name")), userId);
	}

	private boolean tablesReady() {
		Boolean ready = jdbc.queryForObject("""
				SELECT COUNT(*) = 2
				FROM information_schema.tables
				WHERE table_schema = current_schema()
				  AND table_name IN ('teams', 'team_members')
				""", Boolean.class);
		return Boolean.TRUE.equals(ready);
	}
}
