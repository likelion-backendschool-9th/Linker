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
import com.linker.backend.entity.team.type.TeamStatus;

/** Maps the existing ERD table promoted by V20; internal and GitHub identifiers remain distinct. */
@Entity
@Table(name = "teams")
public class Team {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private Long installationId;

	@Column(nullable = false, unique = true)
	private long githubOrgId;

	@Column(nullable = false)
	private String githubOrgLogin;

	@Column(nullable = false)
	private String name;

	@Column(columnDefinition = "text")
	private String description;

	@Column(length = 2048)
	private String avatarUrl;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private TeamStatus status;

	@Column(length = 32)
	private String orgBasePermission;

	@Column(nullable = false)
	private Long createdBy;

	private Instant readOnlySince;

	private Instant archivedAt;

	private Instant deleteScheduledAt;

	@Column(nullable = false)
	private boolean aiSummaryEnabled;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected Team() {
	}

	public static Team create(long installationId, long orgId, String orgLogin, String name,
			String description, String avatarUrl, long createdBy) {
		Team team = new Team();
		team.installationId = installationId;
		team.githubOrgId = orgId;
		team.githubOrgLogin = orgLogin;
		team.name = name;
		team.description = description;
		team.avatarUrl = avatarUrl;
		team.status = TeamStatus.ACTIVE;
		team.createdBy = createdBy;
		team.aiSummaryEnabled = true;
		return team;
	}

	public Long getId() {
		return id;
	}

	public Long getInstallationId() {
		return installationId;
	}

	public long getGithubOrgId() {
		return githubOrgId;
	}

	public String getGithubOrgLogin() {
		return githubOrgLogin;
	}

	public String getName() {
		return name;
	}

	public void changeInfo(String name, String description) {
		this.name = name;
		this.description = description;
	}

	public void complete() { this.status = TeamStatus.COMPLETED; }
	public void resume() { this.status = TeamStatus.ACTIVE; }
	public void changeAiSummary(boolean enabled) { this.aiSummaryEnabled = enabled; }

	public void archive(Instant now) {
		this.status = TeamStatus.ARCHIVED;
		this.archivedAt = now;
	}

	public void scheduleDeletion(Instant chatDeletionAt) {
		this.status = TeamStatus.DELETED;
		this.deleteScheduledAt = chatDeletionAt;
	}

	public String getDescription() {
		return description;
	}

	public String getAvatarUrl() {
		return avatarUrl;
	}

	public TeamStatus getStatus() {
		return status;
	}

	public String getOrgBasePermission() {
		return orgBasePermission;
	}

	public Long getCreatedBy() {
		return createdBy;
	}

	public Instant getReadOnlySince() {
		return readOnlySince;
	}

	public Instant getArchivedAt() {
		return archivedAt;
	}

	public Instant getDeleteScheduledAt() {
		return deleteScheduledAt;
	}

	public boolean isAiSummaryEnabled() {
		return aiSummaryEnabled;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

}
