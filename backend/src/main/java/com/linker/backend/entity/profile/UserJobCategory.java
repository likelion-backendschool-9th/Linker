package com.linker.backend.entity.profile;

import java.time.Instant;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.profile.type.JobCategory;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
		name = "user_job_categories",
		uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "job_category"}))
public class UserJobCategory {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private JobCategory jobCategory;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected UserJobCategory() {
	}

	public static UserJobCategory pick(User user, JobCategory jobCategory) {
		UserJobCategory row = new UserJobCategory();
		row.user = user;
		row.jobCategory = jobCategory;
		return row;
	}

	public String key() {
		return jobCategory.name();
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
