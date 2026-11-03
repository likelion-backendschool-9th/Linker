package com.linker.backend.entity.moderation;

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
@Table(name = "reports")
public class Report extends BaseTimeEntity {

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
}
