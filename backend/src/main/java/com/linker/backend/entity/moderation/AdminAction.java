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
@Table(name = "admin_actions")
public class AdminAction extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "admin_id", nullable = false)
	private Admin admin;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private AdminActionType action;

	@Column(length = 32)
	private String targetType;

	private Long targetId;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "case_id")
	private ReportCase reportCase;

	@Column(length = 2000)
	private String reason;

	protected AdminAction() {
	}

	public static AdminAction record(
			Admin admin,
			AdminActionType action,
			String targetType,
			Long targetId,
			ReportCase reportCase,
			String reason) {
		AdminAction row = new AdminAction();
		row.admin = admin;
		row.action = action;
		row.targetType = targetType;
		row.targetId = targetId;
		row.reportCase = reportCase;
		row.reason = reason;
		return row;
	}

	public AdminActionType getAction() {
		return action;
	}
}
