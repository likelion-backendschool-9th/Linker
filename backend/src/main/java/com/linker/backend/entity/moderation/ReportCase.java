package com.linker.backend.entity.moderation;

import java.time.Instant;

import com.linker.backend.global.jpa.BaseTimeEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "report_cases")
public class ReportCase extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private ReportTargetType targetType;

	@Column(nullable = false)
	private Long targetId;

	@Column(nullable = false)
	private Long targetUserId;

	@Column(nullable = false)
	private int reporterCount;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private ReportCaseStatus status;

	private Instant autoHiddenAt;

	private Long assignedAdminId;

	private Instant resolvedAt;

	protected ReportCase() {
	}

	public static ReportCase open(ReportTargetType targetType, long targetId, long targetUserId) {
		ReportCase reportCase = new ReportCase();
		reportCase.targetType = targetType;
		reportCase.targetId = targetId;
		reportCase.targetUserId = targetUserId;
		reportCase.reporterCount = 0;
		reportCase.status = ReportCaseStatus.PENDING;
		return reportCase;
	}

	public void changeReporterCount(int reporterCount) {
		this.reporterCount = reporterCount;
	}

	public void markAutoHidden(Instant when) {
		this.autoHiddenAt = when;
	}

	public Long getId() {
		return id;
	}

	public ReportTargetType getTargetType() {
		return targetType;
	}

	public Long getTargetId() {
		return targetId;
	}

	public Long getTargetUserId() {
		return targetUserId;
	}

	public Instant getAutoHiddenAt() {
		return autoHiddenAt;
	}

	public int getReporterCount() {
		return reporterCount;
	}

	public ReportCaseStatus getStatus() {
		return status;
	}

	public Instant getResolvedAt() {
		return resolvedAt;
	}

	public void resolve(ReportCaseStatus next, long adminId, Instant when) {
		this.status = next;
		this.assignedAdminId = adminId;
		this.resolvedAt = when;
	}

	public void reopen() {
		this.status = ReportCaseStatus.PENDING;
		this.resolvedAt = null;
	}
}
