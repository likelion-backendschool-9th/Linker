package com.linker.backend.entity.profile;

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

@Entity
@Table(name = "user_tech_tags")
public class UserTechTag extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "tag_id", nullable = false)
	private TechTag tag;

	protected UserTechTag() {
	}

	public static UserTechTag link(User user, TechTag tag) {
		UserTechTag selected = new UserTechTag();
		selected.user = user;
		selected.tag = tag;
		return selected;
	}

	public String tagName() {
		return tag.getName();
	}
}
