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

	private Instant withdrawRequestedAt;

	private Instant deletedAt;

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

	public void touch(Instant when) {
		this.lastActiveAt = when;
	}

	public void rename(String username) {
		this.username = username;
	}

	public void refreshAvatar(String avatarUrl) {
		this.avatarUrl = blankToNull(avatarUrl);
	}

	public void keepNotificationEmail(String email, Instant verifiedAt) {
		if (this.email != null && !this.email.isBlank()) {
			return;
		}
		String value = blankToNull(email);
		if (value == null) {
			return;
		}
		this.email = value;
		this.emailVerifiedAt = verifiedAt;
	}

	public void useGithubDisplayName(String name) {
		String value = blankToNull(name);
		if (value == null) {
			return;
		}
		this.displayName = value.length() <= 20 ? value : value.substring(0, 20);
	}

	/**
	 * @return true when a pending withdrawal inside the restore window becomes active
	 */
	public boolean restoreWithdrawal(Instant now, java.time.Duration window) {
		if (status != UserStatus.WITHDRAWING || withdrawRequestedAt == null) {
			return false;
		}
		if (withdrawRequestedAt.plus(window).isBefore(now)) {
			return false;
		}
		this.status = UserStatus.ACTIVE;
		this.withdrawRequestedAt = null;
		return true;
	}

	public boolean withdrawalExpired(Instant now, java.time.Duration window) {
		return status == UserStatus.WITHDRAWING
				&& (withdrawRequestedAt == null || withdrawRequestedAt.plus(window).isBefore(now));
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

	public String visibleName() {
		if (displayName == null || displayName.isBlank()) {
			return username;
		}
		return displayName;
	}
}
