package com.linker.backend.entity.profile;

import java.time.Instant;
import java.time.LocalDate;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.profile.type.AdEndedReason;
import com.linker.backend.entity.profile.type.AdStatus;
import com.linker.backend.entity.profile.type.JobCategory;

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
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "recruiter_ads")
public class RecruiterAd {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "recruiter_id", nullable = false, unique = true)
	private User recruiter;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private JobCategory jobCategory;

	@Column(nullable = false, length = 40)
	private String title;

	@Column(nullable = false, length = 2048)
	private String url;

	@Column(nullable = false, length = 255)
	private String urlHost;

	@Column(nullable = false)
	private LocalDate closesOn;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private AdStatus status;

	@Enumerated(EnumType.STRING)
	@Column(length = 32)
	private AdEndedReason endedReason;

	private Instant hiddenAt;

	private Instant deletedAt;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected RecruiterAd() {
	}

	public static RecruiterAd create(
			User recruiter,
			JobCategory jobCategory,
			String title,
			String url,
			String urlHost,
			LocalDate closesOn) {
		RecruiterAd ad = new RecruiterAd();
		ad.recruiter = recruiter;
		ad.replace(jobCategory, title, url, urlHost, closesOn);
		return ad;
	}

	public void replace(JobCategory jobCategory, String title, String url, String urlHost, LocalDate closesOn) {
		this.jobCategory = jobCategory;
		this.title = title;
		this.url = url;
		this.urlHost = urlHost;
		this.closesOn = closesOn;
		this.status = AdStatus.ACTIVE;
		this.endedReason = null;
	}

	public void pause() {
		this.status = AdStatus.PAUSED;
	}

	public void resume() {
		this.status = AdStatus.ACTIVE;
	}

	public void end(AdEndedReason reason) {
		this.status = AdStatus.ENDED;
		this.endedReason = reason;
	}

	public boolean locked() {
		return status == AdStatus.HIDDEN || deletedAt != null;
	}

	public Long getId() {
		return id;
	}

	public JobCategory getJobCategory() {
		return jobCategory;
	}

	public String getTitle() {
		return title;
	}

	public String getUrl() {
		return url;
	}

	public LocalDate getClosesOn() {
		return closesOn;
	}

	public AdStatus getStatus() {
		return status;
	}

	public User getRecruiter() {
		return recruiter;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
