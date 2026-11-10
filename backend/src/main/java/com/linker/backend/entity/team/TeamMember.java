package com.linker.backend.entity.team;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import com.linker.backend.entity.team.type.TeamRole;
import com.linker.backend.entity.team.type.GithubOrgState;
import com.linker.backend.entity.team.type.TeamLeaveType;

/** Maps the existing ERD table promoted by V20; internal and GitHub identifiers remain distinct. */
@Entity
@Table(name = "team_members")
public class TeamMember {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private Long teamId;

	@Column(nullable = false)
	private Long userId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private TeamRole role;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private GithubOrgState githubOrgState;

	@Column(nullable = false)
	private Instant joinedAt;

	private Instant leftAt;

	@Enumerated(EnumType.STRING)
	@Column(length = 16)
	private TeamLeaveType leaveType;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected TeamMember() {
	}

	public static TeamMember owner(long teamId, long userId, Instant joinedAt) {
		TeamMember member = new TeamMember();
		member.teamId = teamId;
		member.userId = userId;
		member.role = TeamRole.OWNER;
		member.githubOrgState = GithubOrgState.MEMBER;
		member.joinedAt = joinedAt;
		return member;
	}

	/** Recruit accept (POL-R-4): Linker member first; GitHub org invite is a separate owner action. */
	public static TeamMember member(long teamId, long userId, Instant joinedAt) {
		TeamMember member = new TeamMember();
		member.teamId = teamId;
		member.userId = userId;
		member.role = TeamRole.MEMBER;
		member.githubOrgState = GithubOrgState.NOT_MEMBER;
		member.joinedAt = joinedAt;
		return member;
	}

	public Long getId() {
		return id;
	}

	public void changeRole(TeamRole role) {
		this.role = role;
	}

	public void leave(Instant now, TeamLeaveType reason) {
		if (this.leftAt == null) {
			this.leftAt = now;
			this.leaveType = reason;
		}
	}

	public Long getTeamId() {
		return teamId;
	}

	public Long getUserId() {
		return userId;
	}

	public TeamRole getRole() {
		return role;
	}

	public GithubOrgState getGithubOrgState() {
		return githubOrgState;
	}

	public Instant getJoinedAt() {
		return joinedAt;
	}

	public Instant getLeftAt() {
		return leftAt;
	}

	public TeamLeaveType getLeaveType() {
		return leaveType;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

}
