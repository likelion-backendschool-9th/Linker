package com.linker.backend.entity.account;

import java.time.Instant;

import com.linker.backend.global.jpa.BaseTimeEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "users")
public class User extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true, length = 39)
	private String username;

	@Column(length = 20)
	private String displayName;

	@Column(length = 2048)
	private String avatarUrl;

	@Column(length = 160)
	private String bio;

	@Column(length = 2048)
	private String blogUrl;

	@Column(length = 320)
	private String email;

	private Instant emailVerifiedAt;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private UserType userType;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private UserStatus status;

	private Instant suspendedUntil;

	@Column(nullable = false)
	private boolean lookingForTeam;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private JobSeekingStatus jobSeekingStatus;

	private Instant jobSeekingUpdatedAt;

	@Column(nullable = false)
	private boolean pushEnabled;

	private Instant contributionSyncedAt;

	private Instant lastActiveAt;

	/** Set by the inactivity batch when it turns job seeking off. Cleared after the notice is created. */
	@Column(nullable = false)
	private boolean jobSeekingOffNotice;

	private Instant withdrawRequestedAt;

	private Instant deletedAt;

	/** Set when the onboarding profile step is saved. Drives the session {@code onb} claim. */
	private Instant onboardedAt;

	protected User() {
	}

	public static User create(String username, UserType userType) {
		User user = new User();
		user.username = username;
		user.userType = userType;
		user.status = UserStatus.ACTIVE;
		user.jobSeekingStatus = JobSeekingStatus.OFF;
		user.lookingForTeam = false;
		user.pushEnabled = true;
		return user;
	}

	public void changeDisplayName(String displayName) {
		this.displayName = displayName;
	}

	public void suspendUntil(Instant until) {
		this.status = UserStatus.SUSPENDED;
		this.suspendedUntil = until;
	}

	public void markWithdrawing(Instant when) {
		this.status = UserStatus.WITHDRAWING;
		this.withdrawRequestedAt = when;
	}

	public void markDeleted(Instant when) {
		this.status = UserStatus.DELETED;
		this.deletedAt = when;
	}

	/** Clears personal columns after the pending-withdrawal window. Username stays for the unique key. */
	public void anonymize(Instant when) {
		markDeleted(when);
		this.displayName = null;
		this.avatarUrl = null;
		this.bio = null;
		this.blogUrl = null;
		this.email = null;
	}

	public void touch(Instant when) {
		this.lastActiveAt = when;
	}

	public void clearLookingForTeam() {
		this.lookingForTeam = false;
	}

	public void markJobSeekingOffForInactivity(Instant when) {
		if (this.jobSeekingStatus == JobSeekingStatus.OFF) {
			return;
		}
		this.jobSeekingStatus = JobSeekingStatus.OFF;
		this.jobSeekingUpdatedAt = when;
		this.jobSeekingOffNotice = true;
	}

	public boolean takeJobSeekingOffNotice() {
		if (!this.jobSeekingOffNotice) {
			return false;
		}
		this.jobSeekingOffNotice = false;
		return true;
	}

	public void applyOnboardingProfile(
			String displayName,
			String bio,
			String blogUrl,
			boolean lookingForTeam,
			JobSeekingStatus jobStatus,
			Instant now) {
		this.displayName = displayName;
		this.bio = blankToNull(bio);
		this.blogUrl = blankToNull(blogUrl);
		this.lookingForTeam = lookingForTeam;
		if (this.jobSeekingStatus != jobStatus) {
			this.jobSeekingStatus = jobStatus;
			this.jobSeekingUpdatedAt = now;
		}
	}

	public void keepNotificationEmail(String email) {
		if (this.email != null && !this.email.isBlank()) {
			return;
		}
		this.email = email;
	}

	public void changeNotificationEmail(String email) {
		this.email = email;
	}

	public void setPushEnabled(boolean pushEnabled) {
		this.pushEnabled = pushEnabled;
	}

	public void completeOnboarding(Instant when) {
		if (this.onboardedAt == null) {
			this.onboardedAt = when;
		}
	}

	public boolean isOnboarded() {
		return onboardedAt != null;
	}

	private static String blankToNull(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		String trimmed = value.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}

	public Long getId() {
		return id;
	}

	public String getUsername() {
		return username;
	}

	public String getDisplayName() {
		return displayName;
	}

	public String getBio() {
		return bio;
	}

	public String getBlogUrl() {
		return blogUrl;
	}

	public String getEmail() {
		return email;
	}

	public boolean isPushEnabled() {
		return pushEnabled;
	}

	public boolean isLookingForTeam() {
		return lookingForTeam;
	}

	public JobSeekingStatus getJobSeekingStatus() {
		return jobSeekingStatus;
	}

	public String getAvatarUrl() {
		return avatarUrl;
	}

	public UserType getUserType() {
		return userType;
	}

	public UserStatus getStatus() {
		return status;
	}

	public Instant getSuspendedUntil() {
		return suspendedUntil;
	}

	public Instant getDeletedAt() {
		return deletedAt;
	}

	public Instant getWithdrawRequestedAt() {
		return withdrawRequestedAt;
	}

	public Instant getLastActiveAt() {
		return lastActiveAt;
	}

	public String visibleName() {
		if (displayName == null || displayName.isBlank()) {
			return username;
		}
		return displayName;
	}
}
