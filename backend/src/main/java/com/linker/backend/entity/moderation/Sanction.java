package com.linker.backend.entity.moderation;

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
@Table(name = "sanctions")
public class Sanction extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private SanctionType sanctionType;

	@Column(length = 64)
	private String reasonCode;

	private String reasonDetail;

	@Column(nullable = false)
	private Instant startsAt;

	private Instant endsAt;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "case_id")
	private ReportCase reportCase;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "admin_id", nullable = false)
	private Admin admin;

	private Instant revokedAt;

	private Long revokedBy;

	protected Sanction() {
	}

	public static Sanction reportRestriction(User user, ReportCase reportCase, Admin admin, Instant startsAt, Instant endsAt) {
		Sanction sanction = new Sanction();
		sanction.user = user;
		sanction.sanctionType = SanctionType.REPORT_RESTRICTION;
		sanction.reasonCode = "FALSE_REPORT";
		sanction.reportCase = reportCase;
		sanction.admin = admin;
		sanction.startsAt = startsAt;
		sanction.endsAt = endsAt;
		return sanction;
	}

	public void revoke(Instant when, long adminId) {
		this.revokedAt = when;
		this.revokedBy = adminId;
		this.reasonCode = null;
		this.reasonDetail = null;
	}

	public Long getId() {
		return id;
	}

	public User getUser() {
		return user;
	}

	public SanctionType getSanctionType() {
		return sanctionType;
	}

	public Admin getAdmin() {
		return admin;
	}

	public ReportCase getReportCase() {
		return reportCase;
	}

	public Instant getRevokedAt() {
		return revokedAt;
	}
}
