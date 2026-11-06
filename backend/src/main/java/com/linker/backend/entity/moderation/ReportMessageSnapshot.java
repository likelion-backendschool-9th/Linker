package com.linker.backend.entity.moderation;

import java.time.Instant;

import com.linker.backend.global.jpa.BaseTimeEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "report_message_snapshots")
public class ReportMessageSnapshot extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "report_id", nullable = false)
	private Report report;

	@Column(nullable = false)
	private Long messageId;

	@Column(nullable = false)
	private Long senderId;

	@Column(nullable = false)
	private String body;

	@Column(nullable = false)
	private int relPosition;

	@Column(nullable = false)
	private Instant messageCreatedAt;

	protected ReportMessageSnapshot() {
	}

	public Long getMessageId() {
		return messageId;
	}

	public Long getSenderId() {
		return senderId;
	}

	public String getBody() {
		return body;
	}

	public int getRelPosition() {
		return relPosition;
	}
}
