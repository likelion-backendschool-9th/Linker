package com.linker.backend.entity.post;

import java.time.Instant;

import com.linker.backend.entity.account.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(
		name = "pinned_posts",
		uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "post_id"}))
public class PinnedPost {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "post_id", nullable = false)
	private Post post;

	@Column(nullable = false)
	private int sortOrder;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected PinnedPost() {
	}

	public static PinnedPost create(User user, Post post, int sortOrder) {
		PinnedPost pin = new PinnedPost();
		pin.user = user;
		pin.post = post;
		pin.sortOrder = sortOrder;
		return pin;
	}

	public Long getId() {
		return id;
	}

	public Post getPost() {
		return post;
	}

	public int getSortOrder() {
		return sortOrder;
	}
}
