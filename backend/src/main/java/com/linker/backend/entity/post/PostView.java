package com.linker.backend.entity.post;

import java.time.LocalDate;

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
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
		name = "post_views",
		uniqueConstraints = @UniqueConstraint(
				name = "post_views_post_viewer_date_uk",
				columnNames = {"post_id", "viewer_id", "view_date"}
		)
)
public class PostView extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "post_id", nullable = false)
	private Post post;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "viewer_id", nullable = false)
	private User viewer;

	@Column(nullable = false)
	private LocalDate viewDate;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private PostViewSource source;

	@Column(nullable = false)
	private boolean readmeExpanded;

	protected PostView() {
	}

	public static PostView of(Post post, User viewer, LocalDate viewDate, PostViewSource source) {
		PostView view = new PostView();
		view.post = post;
		view.viewer = viewer;
		view.viewDate = viewDate;
		view.source = source;
		view.readmeExpanded = false;
		return view;
	}

	public void markReadmeExpanded() {
		this.readmeExpanded = true;
	}

	public Long getId() {
		return id;
	}

	public PostViewSource getSource() {
		return source;
	}

	public boolean isReadmeExpanded() {
		return readmeExpanded;
	}
}
