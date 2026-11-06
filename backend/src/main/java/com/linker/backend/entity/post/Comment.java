package com.linker.backend.entity.post;

import java.time.Instant;

import com.linker.backend.entity.account.User;
import com.linker.backend.global.jpa.BaseTimeEntity;

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

@Entity
@Table(name = "comments")
public class Comment extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "post_id", nullable = false)
	private Post post;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "author_id", nullable = false)
	private User author;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "parent_id")
	private Comment parent;

	@Column(nullable = false, length = 500)
	private String body;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private PostVisibility visibility;

	private Instant editedAt;

	private Instant deletedAt;

	protected Comment() {
	}

	public static Comment write(Post post, User author, Comment parent, String body) {
		Comment comment = new Comment();
		comment.post = post;
		comment.author = author;
		comment.parent = parent;
		comment.body = body;
		comment.visibility = PostVisibility.VISIBLE;
		return comment;
	}

	public void edit(String body, Instant editedAt) {
		this.body = body;
		this.editedAt = editedAt;
	}

	public void softDelete(Instant when) {
		this.deletedAt = when;
		this.body = "";
	}

	public Long getId() {
		return id;
	}

	public Post getPost() {
		return post;
	}

	public User getAuthor() {
		return author;
	}

	public Comment getParent() {
		return parent;
	}

	public String getBody() {
		return body;
	}

	public Instant getEditedAt() {
		return editedAt;
	}

	public Instant getDeletedAt() {
		return deletedAt;
	}

	public boolean isDeleted() {
		return deletedAt != null;
	}
}
