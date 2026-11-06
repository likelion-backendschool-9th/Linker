package com.linker.backend.entity.profile;

import java.time.LocalDate;

import com.linker.backend.entity.account.User;
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
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
		name = "profile_visits",
		uniqueConstraints = @UniqueConstraint(columnNames = {"profile_user_id", "visitor_id", "visit_date"}))
public class ProfileVisit extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "profile_user_id", nullable = false)
	private User profileUser;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "visitor_id", nullable = false)
	private User visitor;

	@Column(nullable = false)
	private LocalDate visitDate;

	protected ProfileVisit() {
	}

	public static ProfileVisit record(User profileUser, User visitor, LocalDate visitDate) {
		ProfileVisit visit = new ProfileVisit();
		visit.profileUser = profileUser;
		visit.visitor = visitor;
		visit.visitDate = visitDate;
		return visit;
	}
}
