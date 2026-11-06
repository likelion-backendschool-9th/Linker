package com.linker.backend.entity.issue;

import java.time.Instant;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** Daily per-team status counts for the Flex progress graph; written by the 00:00 KST batch. */
@Entity
@Table(name = "team_progress_snapshots")
public class TeamProgressSnapshot {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private Long teamId;

	@Column(nullable = false)
	private LocalDate snapshotDate;

	@Column(nullable = false)
	private int todoCount;

	@Column(nullable = false)
	private int inProgressCount;

	@Column(nullable = false)
	private int blockedCount;

	@Column(nullable = false)
	private int doneCount;

	@Column(nullable = false)
	private int overdueCount;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected TeamProgressSnapshot() {
	}

	public Long getId() {
		return id;
	}

	public Long getTeamId() {
		return teamId;
	}

	public LocalDate getSnapshotDate() {
		return snapshotDate;
	}

	public int getTodoCount() {
		return todoCount;
	}

	public int getInProgressCount() {
		return inProgressCount;
	}

	public int getBlockedCount() {
		return blockedCount;
	}

	public int getDoneCount() {
		return doneCount;
	}

	public int getOverdueCount() {
		return overdueCount;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
