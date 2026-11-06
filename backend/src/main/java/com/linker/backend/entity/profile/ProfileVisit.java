package com.linker.backend.entity.profile;

import java.time.Instant;
import java.time.LocalDate;

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
		name = "profile_visits",
		uniqueConstraints = @UniqueConstraint(columnNames = {"profile_user_id", "visitor_id", "visit_date"}))
public class ProfileVisit {

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

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected ProfileVisit() {
	}

	public static ProfileVisit record(User profileUser, User visitor, LocalDate visitDate) {
		ProfileVisit visit = new ProfileVisit();
		visit.profileUser = profileUser;
		visit.visitor = visitor;
		visit.visitDate = visitDate;
		return visit;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
