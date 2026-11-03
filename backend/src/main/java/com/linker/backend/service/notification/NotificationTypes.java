package com.linker.backend.service.notification;

/**
 * Known {@code notifications.notification_type} values. Producers may add more strings;
 * quiet-hours rules only special-case {@link #CHAT} and {@link #MARKETING}.
 */
public final class NotificationTypes {

	public static final String CHAT = "CHAT";
	public static final String ISSUE_ASSIGNED = "ISSUE_ASSIGNED";
	public static final String DUE_SOON = "DUE_SOON";
	public static final String APPLICATION_RECEIVED = "APPLICATION_RECEIVED";
	public static final String APPLICATION_REJECTED = "APPLICATION_REJECTED";
	public static final String COMMENT = "COMMENT";
	public static final String FOLLOW = "FOLLOW";
	public static final String MESSAGE_REQUEST = "MESSAGE_REQUEST";
	public static final String TEAM_INVITE = "TEAM_INVITE";
	public static final String MARKETING = "MARKETING";

	private NotificationTypes() {
	}
}
