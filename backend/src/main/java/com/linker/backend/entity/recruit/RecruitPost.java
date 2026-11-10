package com.linker.backend.entity.recruit;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.recruit.type.RecruitGoal;
import com.linker.backend.entity.recruit.type.RecruitStatus;
import com.linker.backend.entity.recruit.type.RecruitVisibility;
import com.linker.backend.entity.recruit.type.WorkMode;

import jakarta.persistence.CascadeType;
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
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "recruit_posts")
public class RecruitPost {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "author_id", nullable = false)
	private User author;

	private Long teamId;

	@Column(nullable = false, length = 40)
	private String title;

	@Column(nullable = false, length = 1000)
	private String description;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private WorkMode workMode;

	@Column(length = 100)
	private String region;

	@Enumerated(EnumType.STRING)
	@Column(length = 16)
	private RecruitGoal goal;

	@Column(length = 40)
	private String expectedPeriod;

	@Column(nullable = false)
	private LocalDate deadline;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private RecruitStatus status;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private RecruitVisibility visibility;

	@Column(nullable = false)
	private Instant sortAt;

	private Instant closedAt;

	private Instant deletedAt;

	@OneToMany(mappedBy = "recruitPost", cascade = CascadeType.ALL, orphanRemoval = true)
	private List<RecruitRole> roles = new ArrayList<>();

	@OneToMany(mappedBy = "recruitPost", cascade = CascadeType.ALL, orphanRemoval = true)
	private List<RecruitPostTag> tags = new ArrayList<>();

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected RecruitPost() {
	}

	public static RecruitPost open(
			User author,
			String title,
			String description,
			WorkMode workMode,
			String region,
			RecruitGoal goal,
			String expectedPeriod,
			LocalDate deadline,
			Instant sortAt
	) {
		RecruitPost post = new RecruitPost();
		post.author = author;
		post.title = title;
		post.description = description;
		post.workMode = workMode;
		post.region = region;
		post.goal = goal;
		post.expectedPeriod = expectedPeriod;
		post.deadline = deadline;
		post.status = RecruitStatus.OPEN;
		post.visibility = RecruitVisibility.VISIBLE;
		post.sortAt = sortAt;
		return post;
	}

	public void addRole(RecruitRole role) {
		roles.add(role);
		role.attach(this);
	}

	public void addTag(RecruitPostTag tag) {
		tags.add(tag);
		tag.attach(this);
	}

	public void assignTeam(Long teamId) {
		this.teamId = teamId;
	}

	public void updateContent(
			String title,
			String description,
			WorkMode workMode,
			String region,
			RecruitGoal goal,
			String expectedPeriod,
			LocalDate deadline
	) {
		this.title = title;
		this.description = description;
		this.workMode = workMode;
		this.region = region;
		this.goal = goal;
		this.expectedPeriod = expectedPeriod;
		this.deadline = deadline;
	}

	/**
	 * Diff-based replace avoids Hibernate flushing INSERT before DELETE for the same
	 * {@code (recruit_post_id, tag_id)} UK when an overlapping tag is kept on update.
	 */
	public void replaceTags(List<RecruitPostTag> next) {
		List<RecruitPostTag> desiredTags = next == null ? List.of() : next;
		Set<Long> desired = new HashSet<>();
		for (RecruitPostTag tag : desiredTags) {
			desired.add(tag.getTag().getId());
		}
		tags.removeIf(existing -> !desired.contains(existing.getTag().getId()));
		Set<Long> present = new HashSet<>();
		for (RecruitPostTag existing : tags) {
			present.add(existing.getTag().getId());
		}
		for (RecruitPostTag tag : desiredTags) {
			if (!present.contains(tag.getTag().getId())) {
				addTag(tag);
			}
		}
	}

	public void removeRole(RecruitRole role) {
		roles.remove(role);
	}

	public void close(Instant closedAt) {
		this.status = RecruitStatus.CLOSED;
		this.closedAt = closedAt;
	}

	public void reopen() {
		this.status = RecruitStatus.OPEN;
		this.closedAt = null;
	}

	public void softDelete(Instant deletedAt) {
		this.deletedAt = deletedAt;
		if (this.status == RecruitStatus.OPEN) {
			this.status = RecruitStatus.CLOSED;
			this.closedAt = deletedAt;
		}
	}

	public boolean allRolesFull() {
		if (roles.isEmpty()) {
			return false;
		}
		return roles.stream().allMatch(RecruitRole::isFull);
	}

	public Long getId() {
		return id;
	}

	public User getAuthor() {
		return author;
	}

	public Long getTeamId() {
		return teamId;
	}

	public String getTitle() {
		return title;
	}

	public String getDescription() {
		return description;
	}

	public WorkMode getWorkMode() {
		return workMode;
	}

	public String getRegion() {
		return region;
	}

	public RecruitGoal getGoal() {
		return goal;
	}

	public String getExpectedPeriod() {
		return expectedPeriod;
	}

	public LocalDate getDeadline() {
		return deadline;
	}

	public RecruitStatus getStatus() {
		return status;
	}

	public RecruitVisibility getVisibility() {
		return visibility;
	}

	public Instant getSortAt() {
		return sortAt;
	}

	public Instant getDeletedAt() {
		return deletedAt;
	}

	public List<RecruitRole> getRoles() {
		return roles;
	}

	public List<RecruitPostTag> getTags() {
		return tags;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
