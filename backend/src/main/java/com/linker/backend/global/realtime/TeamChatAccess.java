package com.linker.backend.global.realtime;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.linker.backend.dto.chat.response.ChatMemberResponse;
import com.linker.backend.entity.team.Team;
import com.linker.backend.entity.team.TeamMember;
import com.linker.backend.entity.team.type.TeamStatus;
import com.linker.backend.repository.team.TeamMemberRepository;
import com.linker.backend.repository.team.TeamRepository;

import org.springframework.stereotype.Component;

/** Reads the B-owned team tables for chat only: a current member of a team that is not deleted. */
@Component
public class TeamChatAccess {
	private final TeamRepository teams;
	private final TeamMemberRepository members;

	public TeamChatAccess(TeamRepository teams, TeamMemberRepository members) {
		this.teams = teams;
		this.members = members;
	}

	public TeamView readableBy(long userId, long teamId) {
		Team team = teams.findById(teamId)
				.filter(found -> found.getStatus() != TeamStatus.DELETED)
				.orElse(null);
		if (team == null) {
			return null;
		}
		return members.findByTeamIdAndUserIdAndLeftAtIsNull(teamId, userId)
				.map(member -> new TeamView(team.getId(), team.getName(), team.getStatus().name(), member.getRole().name(), team.getAvatarUrl()))
				.orElse(null);
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
		return members.findChatMentionCandidates(teamId);
	}

	/** Current members' team roles by user id, for the room info member list. Call after {@link #readableBy}. */
	public Map<Long, String> roles(long teamId) {
		Map<Long, String> roles = new HashMap<>();
		for (TeamMember member : members.findByTeamIdAndLeftAtIsNullOrderByJoinedAtAscIdAsc(teamId)) {
			roles.put(member.getUserId(), member.getRole().name());
		}
		return roles;
	}

	public record TeamView(long id, String name, String status, String role, String avatarUrl) {
	}
}
