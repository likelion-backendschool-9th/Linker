package com.linker.backend.entity.moderation;

import java.time.Instant;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.moderation.type.SanctionType;

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
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "sanctions")
public class Sanction {

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

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected Sanction() {
	}

	public static Sanction issue(User user, SanctionType type, Admin admin, Instant startsAt) {
		Sanction sanction = new Sanction();
		sanction.user = user;
		sanction.sanctionType = type;
		sanction.admin = admin;
		sanction.startsAt = startsAt;
		return sanction;
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

	public static Sanction account(User user, SanctionType type, Admin admin, Instant start,
			Instant end, String code, String reason) {
		Sanction row = issue(user, type, admin, start);
		row.endsAt = end;
		row.reasonCode = code;
		row.reasonDetail = reason;
		return row;
	}

	/** Manual lifting keeps the violation history; accepted appeals use revoke instead. */
	public void lift(Instant when, long adminId) {
		this.revokedAt = when;
		this.revokedBy = adminId;
	}

	public String getReasonCode() { return reasonCode; }
	public String getReasonDetail() { return reasonDetail; }
	public Instant getStartsAt() { return startsAt; }
	public Instant getEndsAt() { return endsAt; }

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

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
