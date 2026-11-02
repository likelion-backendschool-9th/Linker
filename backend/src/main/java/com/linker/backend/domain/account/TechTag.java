package com.linker.backend.domain.account;

import com.linker.backend.global.jpa.BaseTimeEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "tech_tags")
public class TechTag extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true, length = 40)
	private String name;

	@Column(nullable = false, length = 32)
	private String category;

	@Column(nullable = false)
	private int sortOrder;

	protected TechTag() {
	}

	public Long getId() {
		return id;
	}

	public String getName() {
		return name;
	}
}
