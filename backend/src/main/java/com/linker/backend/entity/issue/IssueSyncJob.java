package com.linker.backend.entity.issue;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;
import com.linker.backend.entity.issue.type.IssueSyncJobStatus;
import com.linker.backend.entity.issue.type.IssueSyncStep;

/**
 * Durable GitHub write intent (pages 12–13). Payload holds desired values only, never tokens.
 * createdAt is the application clock, not a Hibernate timestamp: the per-author KST daily creation
 * quota counts rows by it.
 */
@Entity
@Table(name = "issue_sync_jobs")
public class IssueSyncJob {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private Long issueId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private IssueSyncStep step;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(nullable = false, columnDefinition = "jsonb")
	private String payload;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private IssueSyncJobStatus status;

	@Column(nullable = false)
	private int attempts;

	@Column(nullable = false)
	private Instant nextRetryAt;

	@Column(columnDefinition = "text")
	private String lastError;

	@Column(nullable = false)
	private Long requestedBy;

	private Long teamId;

	private UUID requestKey;

	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected IssueSyncJob() {
	}

	/** Page 12 edit of an existing cached issue. */
	public static IssueSyncJob edit(long issueId, long actor, IssueSyncStep step, String payload, Instant now) {
		IssueSyncJob job = pending(actor, step, payload, now);
		job.issueId = issueId;
		return job;
	}

	/** Page 13 creation intent: no local issue exists until GitHub confirms one. */
	public static IssueSyncJob create(long teamId, long actor, UUID requestKey, String payload, Instant now) {
		IssueSyncJob job = pending(actor, IssueSyncStep.CREATE, payload, now);
		job.teamId = teamId;
		job.requestKey = requestKey;
		return job;
	}

	private static IssueSyncJob pending(long actor, IssueSyncStep step, String payload, Instant now) {
		IssueSyncJob job = new IssueSyncJob();
		job.requestedBy = actor;
		job.step = step;
		job.payload = payload;
		job.status = IssueSyncJobStatus.PENDING;
		job.nextRetryAt = now;
		job.createdAt = now;
		return job;
	}

	/** Page 13 progress: the next step's payload and, once GitHub confirms it, the issue. */
	public void checkpoint(String payload, Long issueId) {
		this.payload = payload;
		this.issueId = issueId;
	}

	public Long getId() {
		return id;
	}

	public Long getIssueId() {
		return issueId;
	}

	public IssueSyncStep getStep() {
		return step;
	}

	public String getPayload() {
		return payload;
	}

	public IssueSyncJobStatus getStatus() {
		return status;
	}

	public int getAttempts() {
		return attempts;
	}

	public Instant getNextRetryAt() {
		return nextRetryAt;
	}

	public String getLastError() {
		return lastError;
	}

	public Long getRequestedBy() {
		return requestedBy;
	}

	public Long getTeamId() {
		return teamId;
	}

	public UUID getRequestKey() {
		return requestKey;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
