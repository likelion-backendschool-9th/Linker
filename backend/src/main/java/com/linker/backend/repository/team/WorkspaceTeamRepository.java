package com.linker.backend.repository.team;

import java.time.Instant;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Read projections over the ERD's shared team tables; no GitHub calls or writes. */
@Repository
public class WorkspaceTeamRepository {
	private final JdbcTemplate jdbc;

	public WorkspaceTeamRepository(JdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	public boolean schemaReady() {
		return Boolean.TRUE.equals(jdbc.queryForObject("""
				select to_regclass('public.teams') is not null
				   and to_regclass('public.team_members') is not null
				""", Boolean.class));
	}

	public List<TeamRow> findCurrentTeams(long userId) {
		boolean issuesReady = Boolean.TRUE.equals(jdbc.queryForObject("""
				select to_regclass('public.issues') is not null
				   and to_regclass('public.github_repos') is not null
				   and to_regclass('public.team_repos') is not null
				""", Boolean.class));
		// C's page-11 read scope: only currently linked, non-deleted repositories/issues.
		// No durable full-sync-completed contract exists yet. A zero cache count stays unknown.
		String issueColumn = issuesReady ? """
				(select nullif(count(*), 0) from issues issue
				 join github_repos repo on repo.id = issue.repo_id and repo.deleted_at is null
				 join team_repos linked on linked.repo_id = issue.repo_id and linked.team_id = issue.team_id
				 where issue.team_id = t.id and issue.state = 'OPEN' and issue.deleted_at is null)
				""" : "cast(null as bigint)";
		// Page-16 unread semantics: read pointer, excluding self; team chat ignores blocks.
		// Hidden/deleted message placeholders still count, as in ChatRoomRepositoryImpl.
		return jdbc.query("""
				select t.id, t.name, t.avatar_url, t.status, mine.role, mine.joined_at,
				       (select count(*) from team_members member
				        where member.team_id = t.id and member.left_at is null) as member_count,
				       %s as open_issue_count,
				       case when participant.id is not null then room.id end as chat_room_id,
				       case when participant.id is not null then (
				         select count(*) from chat_messages message
				         where message.room_id = room.id
				           and (participant.last_read_message_id is null or message.id > participant.last_read_message_id)
				           and (message.sender_id is null or message.sender_id <> mine.user_id)
				       ) end as unread_count
				from teams t
				join team_members mine on mine.team_id = t.id
				left join chat_rooms room on room.team_id = t.id and room.room_type = 'TEAM'
				left join chat_room_members participant on participant.room_id = room.id
				  and participant.user_id = mine.user_id and participant.left_at is null
				  and participant.hidden_at is null
				where mine.user_id = ? and mine.left_at is null and t.status <> 'DELETED'
				order by case when t.status = 'ARCHIVED' then 1 else 0 end,
				         mine.joined_at desc, t.id desc
				""".formatted(issueColumn), (row, number) -> new TeamRow(
					row.getLong("id"), row.getString("name"), row.getString("avatar_url"),
					row.getString("status"), row.getString("role"), row.getLong("member_count"),
					row.getTimestamp("joined_at").toInstant(), row.getObject("chat_room_id", Long.class),
					row.getObject("unread_count", Long.class), row.getObject("open_issue_count", Long.class)
				), userId);
	}

	public record TeamRow(long id, String name, String avatarUrl, String status, String role,
			long memberCount, Instant joinedAt, Long chatRoomId, Long unreadCount, Long openIssueCount) {
	}
}
