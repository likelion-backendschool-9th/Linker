package com.linker.backend.entity.post;

import com.linker.backend.entity.account.User;
import com.linker.backend.global.jpa.BaseTimeEntity;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
		name = "post_likes",
		uniqueConstraints = @UniqueConstraint(name = "post_likes_post_user_uk", columnNames = {"post_id", "user_id"})
)
public class PostLike extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "post_id", nullable = false)
	private Post post;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	protected PostLike() {
	}

	public static PostLike of(Post post, User user) {
		PostLike like = new PostLike();
		like.post = post;
		like.user = user;
		return like;
	}

	public Long getId() {
		return id;
	}

	public Post getPost() {
		return post;
	}

	public User getUser() {
		return user;
	}
}
