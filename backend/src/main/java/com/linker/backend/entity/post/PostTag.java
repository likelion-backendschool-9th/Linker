package com.linker.backend.entity.post;

import com.linker.backend.entity.profile.TechTag;
import com.linker.backend.global.jpa.BaseTimeEntity;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "post_tags")
public class PostTag extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "post_id", nullable = false)
	private Post post;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "tag_id", nullable = false)
	private TechTag tag;

	protected PostTag() {
	}

	public static PostTag of(TechTag tag) {
		PostTag item = new PostTag();
		item.tag = tag;
		return item;
	}

	void attach(Post post) {
		this.post = post;
	}

	public TechTag getTag() {
		return tag;
	}
}
