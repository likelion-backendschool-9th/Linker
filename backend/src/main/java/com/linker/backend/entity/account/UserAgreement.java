package com.linker.backend.entity.account;

import java.time.Instant;

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
@Table(name = "user_agreements")
public class UserAgreement extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private AgreementType agreementType;

	@Column(nullable = false, length = 32)
	private String version;

	@Column(nullable = false)
	private Instant agreedAt;

	private Instant withdrawnAt;

	protected UserAgreement() {
	}

	public static UserAgreement accept(User user, AgreementType type, String version, Instant when) {
		UserAgreement agreement = new UserAgreement();
		agreement.user = user;
		agreement.agreementType = type;
		agreement.version = version;
		agreement.agreedAt = when;
		return agreement;
	}

	public void acceptAgain(Instant when) {
		this.agreedAt = when;
		this.withdrawnAt = null;
	}

	public void withdraw(Instant when) {
		this.withdrawnAt = when;
	}

	public boolean isActive() {
		return withdrawnAt == null;
	}
}
