package com.linker.backend.entity.issue;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** GitHub label copied per issue (name unique within the issue). */
@Entity
@Table(name = "issue_labels")
public class IssueLabel {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private Long issueId;

	@Column(nullable = false)
	private String name;

	@Column(nullable = false, length = 16)
	private String color;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected IssueLabel() {
	}

	public IssueLabel(long issueId, String name, String color) {
		this.issueId = issueId;
		this.name = name;
		this.color = color;
	}

	public Long getId() {
		return id;
	}

	public Long getIssueId() {
		return issueId;
	}

	public String getName() {
		return name;
	}

	public String getColor() {
		return color;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
