package com.linker.backend.entity.moderation;

import java.time.Instant;

import com.linker.backend.entity.moderation.type.AdminActionType;

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
@Table(name = "admin_actions")
public class AdminAction {

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

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

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

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
