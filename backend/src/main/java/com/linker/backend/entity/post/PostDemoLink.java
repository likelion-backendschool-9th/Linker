package com.linker.backend.entity.post;

import com.linker.backend.global.jpa.BaseTimeEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "post_demo_links")
public class PostDemoLink extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "post_id", nullable = false)
	private Post post;

	@Column(nullable = false, length = 2048)
	private String url;

	@Column(nullable = false)
	private int sortOrder;

	protected PostDemoLink() {
	}

	public static PostDemoLink of(String url, int sortOrder) {
		PostDemoLink link = new PostDemoLink();
		link.url = url;
		link.sortOrder = sortOrder;
		return link;
	}

	void attach(Post post) {
		this.post = post;
	}

	public String getUrl() {
		return url;
	}

	public int getSortOrder() {
		return sortOrder;
	}
}
