package com.linker.backend.entity.profile;

import java.time.Instant;
import java.time.LocalDate;

import com.linker.backend.entity.account.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(
		name = "contribution_days",
		uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "day"}))
public class ContributionDay {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Column(nullable = false)
	private LocalDate day;

	@Column(nullable = false)
	private int contributionCount;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected ContributionDay() {
	}

	public static ContributionDay record(User user, LocalDate day, int contributionCount) {
		ContributionDay row = new ContributionDay();
		row.user = user;
		row.day = day;
		row.contributionCount = contributionCount;
		return row;
	}

	public LocalDate getDay() {
		return day;
	}

	public int getContributionCount() {
		return contributionCount;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
