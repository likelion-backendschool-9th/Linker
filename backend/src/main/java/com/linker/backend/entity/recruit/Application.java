package com.linker.backend.entity.recruit;

import java.time.Instant;

import com.linker.backend.entity.account.User;
import com.linker.backend.global.jpa.BaseTimeEntity;

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

@Entity
@Table(name = "applications")
public class Application extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "recruit_post_id", nullable = false)
	private RecruitPost recruitPost;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "recruit_role_id", nullable = false)
	private RecruitRole recruitRole;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "applicant_id", nullable = false)
	private User applicant;

	@Column(nullable = false, length = 300)
	private String message;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private ApplicationStatus status;

	@Column(nullable = false)
	private int attempt;

	@Column(length = 300)
	private String rejectReason;

	@Column(nullable = false)
	private Instant expiresAt;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "decided_by")
	private User decidedBy;

	private Instant decidedAt;

	protected Application() {
	}

	public static Application pending(
			RecruitPost recruitPost,
			RecruitRole recruitRole,
			User applicant,
			String message,
			int attempt,
			Instant expiresAt
	) {
		Application application = new Application();
		application.recruitPost = recruitPost;
		application.recruitRole = recruitRole;
		application.applicant = applicant;
		application.message = message;
		application.status = ApplicationStatus.PENDING;
		application.attempt = attempt;
		application.expiresAt = expiresAt;
		return application;
	}

	public void cancel() {
		this.status = ApplicationStatus.CANCELED;
	}

	public void expire() {
		this.status = ApplicationStatus.EXPIRED;
	}

	public Long getId() {
		return id;
	}

	public RecruitPost getRecruitPost() {
		return recruitPost;
	}

	public RecruitRole getRecruitRole() {
		return recruitRole;
	}

	public User getApplicant() {
		return applicant;
	}

	public String getMessage() {
		return message;
	}

	public ApplicationStatus getStatus() {
		return status;
	}

	public int getAttempt() {
		return attempt;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}
}
