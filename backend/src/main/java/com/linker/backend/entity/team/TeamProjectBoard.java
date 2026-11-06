package com.linker.backend.entity.team;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** Maps the existing ERD table promoted by V20; internal and GitHub identifiers remain distinct. */
@Entity
@Table(name = "team_project_boards")
public class TeamProjectBoard {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true)
	private Long teamId;

	@Column(nullable = false)
	private String githubProjectNodeId;

	@Column(nullable = false)
	private int projectNumber;

	@Column(nullable = false)
	private String title;

	@Column(nullable = false)
	private boolean createdByLinker;

	@Column(nullable = false)
	private String statusFieldId;

	@Column(nullable = false)
	private String startDateFieldId;

	@Column(nullable = false)
	private String dueDateFieldId;

	@Column(nullable = false)
	private Long connectedBy;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected TeamProjectBoard() {
	}

	public Long getId() {
		return id;
	}

	public Long getTeamId() {
		return teamId;
	}

	public String getGithubProjectNodeId() {
		return githubProjectNodeId;
	}

	public int getProjectNumber() {
		return projectNumber;
	}

	public String getTitle() {
		return title;
	}

	public boolean isCreatedByLinker() {
		return createdByLinker;
	}

	public String getStatusFieldId() {
		return statusFieldId;
	}

	public String getStartDateFieldId() {
		return startDateFieldId;
	}

	public String getDueDateFieldId() {
		return dueDateFieldId;
	}

	public Long getConnectedBy() {
		return connectedBy;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

}
