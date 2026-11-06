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
		name = "feed_seen_posts",
		uniqueConstraints = @UniqueConstraint(
				name = "feed_seen_posts_user_post_uk",
				columnNames = {"user_id", "post_id"}
		)
)
public class FeedSeenPost {

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
	private Instant seenAt;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected FeedSeenPost() {
	}

	public static FeedSeenPost of(User user, Post post, Instant seenAt) {
		FeedSeenPost row = new FeedSeenPost();
		row.user = user;
		row.post = post;
		row.seenAt = seenAt;
		return row;
	}

	public void touchSeenAt(Instant seenAt) {
		this.seenAt = seenAt;
	}

	public Long getId() {
		return id;
	}

	public User getUser() {
		return user;
	}

	public Post getPost() {
		return post;
	}

	public Instant getSeenAt() {
		return seenAt;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
