package com.linker.backend.entity.moderation;

import java.time.Instant;

import com.linker.backend.entity.moderation.type.ReportReason;

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
@Table(name = "reports")
public class Report {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "case_id", nullable = false)
	private ReportCase reportCase;

	@Column(nullable = false)
	private Long reporterId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private ReportReason reason;

	@Column(length = 1000)
	private String detail;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected Report() {
	}

	public static Report create(ReportCase reportCase, long reporterId, ReportReason reason, String detail) {
		Report report = new Report();
		report.reportCase = reportCase;
		report.reporterId = reporterId;
		report.reason = reason;
		report.detail = detail;
		return report;
	}

	public Long getId() {
		return id;
	}

	public Long getReporterId() {
		return reporterId;
	}

	public ReportReason getReason() {
		return reason;
	}

	public String getDetail() {
		return detail;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
