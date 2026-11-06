package com.linker.backend.entity.recruit;

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
@Table(name = "recruit_post_tags")
public class RecruitPostTag extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "recruit_post_id", nullable = false)
	private RecruitPost recruitPost;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "tag_id", nullable = false)
	private TechTag tag;

	protected RecruitPostTag() {
	}

	public static RecruitPostTag of(TechTag tag) {
		RecruitPostTag item = new RecruitPostTag();
		item.tag = tag;
		return item;
	}

	void attach(RecruitPost recruitPost) {
		this.recruitPost = recruitPost;
	}

	public Long getId() {
		return id;
	}

	public TechTag getTag() {
		return tag;
	}
}
