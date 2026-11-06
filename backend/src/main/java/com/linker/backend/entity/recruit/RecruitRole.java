package com.linker.backend.entity.recruit;

import java.time.Instant;

import com.linker.backend.entity.recruit.type.RecruitRoleType;

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
@Table(name = "recruit_roles")
public class RecruitRole {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "recruit_post_id", nullable = false)
	private RecruitPost recruitPost;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private RecruitRoleType role;

	@Column(nullable = false)
	private int headcount;

	@Column(nullable = false)
	private int acceptedCount;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected RecruitRole() {
	}

	public static RecruitRole of(RecruitRoleType role, int headcount) {
		RecruitRole item = new RecruitRole();
		item.role = role;
		item.headcount = headcount;
		item.acceptedCount = 0;
		return item;
	}

	void attach(RecruitPost recruitPost) {
		this.recruitPost = recruitPost;
	}

	public Long getId() {
		return id;
	}

	public RecruitPost getRecruitPost() {
		return recruitPost;
	}

	public RecruitRoleType getRole() {
		return role;
	}

	public int getHeadcount() {
		return headcount;
	}

	public int getAcceptedCount() {
		return acceptedCount;
	}

	public int remaining() {
		return headcount - acceptedCount;
	}

	public void updateHeadcount(int headcount) {
		this.headcount = headcount;
	}

	public void incrementAccepted() {
		this.acceptedCount += 1;
	}

	public boolean isFull() {
		return acceptedCount >= headcount;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
