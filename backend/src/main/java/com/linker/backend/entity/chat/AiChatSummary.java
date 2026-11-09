package com.linker.backend.entity.chat;

import java.time.Instant;

import com.linker.backend.entity.chat.type.AiSummaryStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "ai_chat_summaries")
public class AiChatSummary {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private Long roomId;

	@Column(nullable = false)
	private Long requesterId;

	/** Always last-N messages; stored for ERD compatibility (no range picker). */
	@Column(nullable = false, length = 32)
	private String rangeType;

	private Long fromMessageId;

	private Long toMessageId;

	@Column(nullable = false)
	private int messageCount;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private AiSummaryStatus status;

	@Column(columnDefinition = "text")
	private String summaryLine;

	@Column(length = 64)
	private String llmModel;

	private Long sharedMessageId;

	@Column(nullable = false)
	private Instant expiresAt;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected AiChatSummary() {
	}

	public static AiChatSummary pending(
			long roomId,
			long requesterId,
			int messageCount,
			Long fromMessageId,
			Long toMessageId,
			String llmModel,
			Instant expiresAt
	) {
		AiChatSummary row = new AiChatSummary();
		row.roomId = roomId;
		row.requesterId = requesterId;
		row.rangeType = "RECENT_500";
		row.messageCount = messageCount;
		row.fromMessageId = fromMessageId;
		row.toMessageId = toMessageId;
		row.status = AiSummaryStatus.PENDING;
		row.llmModel = llmModel;
		row.expiresAt = expiresAt;
		return row;
	}

	public void complete(String summaryLine) {
		this.summaryLine = summaryLine;
		this.status = AiSummaryStatus.DONE;
	}

	public void fail() {
		this.status = AiSummaryStatus.FAILED;
	}

	public Long getId() {
		return id;
	}

	public Long getRoomId() {
		return roomId;
	}

	public Long getRequesterId() {
		return requesterId;
	}

	public int getMessageCount() {
		return messageCount;
	}

	public AiSummaryStatus getStatus() {
		return status;
	}

	public String getSummaryLine() {
		return summaryLine;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
