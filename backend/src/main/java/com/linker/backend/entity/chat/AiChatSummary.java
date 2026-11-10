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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * Page 17 AI chat summary in minutes form (POL-C-5). The three item lists are jsonb arrays of
 * {@code {text, messageId}}; {@code messageId} points at the source message and may be null.
 */
@Entity
@Table(name = "ai_chat_summaries")
public class AiChatSummary {

	/** Latest messages within the input budget. The range picker values in the ERD are not offered yet. */
	public static final String RANGE_LATEST = "LATEST";

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private Long roomId;

	@Column(nullable = false)
	private Long requesterId;

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

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(columnDefinition = "jsonb")
	private String decisions;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(columnDefinition = "jsonb")
	private String actionItems;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(columnDefinition = "jsonb")
	private String openQuestions;

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
		row.rangeType = RANGE_LATEST;
		row.messageCount = messageCount;
		row.fromMessageId = fromMessageId;
		row.toMessageId = toMessageId;
		row.status = AiSummaryStatus.PENDING;
		row.llmModel = llmModel;
		row.expiresAt = expiresAt;
		return row;
	}

	/** Item lists are JSON arrays; see the class comment. */
	public void complete(String summaryLine, String decisions, String actionItems, String openQuestions) {
		this.summaryLine = summaryLine;
		this.decisions = decisions;
		this.actionItems = actionItems;
		this.openQuestions = openQuestions;
		this.status = AiSummaryStatus.DONE;
	}

	public void fail() {
		this.status = AiSummaryStatus.FAILED;
	}

	public void markShared(long messageId) {
		this.sharedMessageId = messageId;
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

	public String getDecisions() {
		return decisions;
	}

	public String getActionItems() {
		return actionItems;
	}

	public String getOpenQuestions() {
		return openQuestions;
	}

	public Long getSharedMessageId() {
		return sharedMessageId;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
