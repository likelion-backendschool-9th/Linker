package com.linker.backend.entity.account;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "recruiter_profiles")
public class RecruiterProfile {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@OneToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false, unique = true)
	private User user;

	@Column(nullable = false, length = 40)
	private String companyName;

	@Column(nullable = false, length = 255)
	private String companyEmailDomain;

	@Column(nullable = false, length = 30)
	private String jobTitle;

	@Column(length = 2048)
	private String companyUrl;

	@Column(nullable = false)
	private Instant emailVerifiedAt;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected RecruiterProfile() {
	}

	public static RecruiterProfile create(
			User user,
			String companyName,
			String companyEmailDomain,
			String jobTitle,
			String companyUrl,
			Instant verifiedAt) {
		RecruiterProfile profile = new RecruiterProfile();
		profile.user = user;
		profile.companyName = companyName;
		profile.companyEmailDomain = companyEmailDomain;
		profile.jobTitle = jobTitle;
		profile.companyUrl = companyUrl;
		profile.emailVerifiedAt = verifiedAt;
		return profile;
	}

	public String getCompanyName() {
		return companyName;
	}

	public String getCompanyEmailDomain() {
		return companyEmailDomain;
	}

	public String getJobTitle() {
		return jobTitle;
	}

	public String getCompanyUrl() {
		return companyUrl;
	}

	public void update(String companyName, String jobTitle, String companyUrl) {
		this.companyName = companyName;
		this.jobTitle = jobTitle;
		this.companyUrl = companyUrl;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
