package com.linker.backend.entity.notification.type;

/**
 * Known {@code notifications.notification_type} values. Producers may add more strings;
 * quiet-hours rules only special-case chat types ({@link #isChat}) and {@link #MARKETING}.
 */
public final class NotificationTypes {

	public static final String CHAT = "CHAT";
	/** Team chat {@code @person} mention. Pushed even when the room is muted (Policy ch. 8). */
	public static final String CHAT_MENTION = "CHAT_MENTION";
	public static final String ISSUE_ASSIGNED = "ISSUE_ASSIGNED";
	public static final String DUE_SOON = "DUE_SOON";
	public static final String APPLICATION_RECEIVED = "APPLICATION_RECEIVED";
	public static final String APPLICATION_ACCEPTED = "APPLICATION_ACCEPTED";
	public static final String APPLICATION_REJECTED = "APPLICATION_REJECTED";
	/** Recruit post deleted → pending applications expire (POL-R). */
	public static final String APPLICATION_EXPIRED = "APPLICATION_EXPIRED";
	public static final String COMMENT = "COMMENT";
	/** Post like (POL-P-5 / WBS page 23). */
	public static final String POST_LIKE = "POST_LIKE";
	public static final String FOLLOW = "FOLLOW";
	/** Monday 09:00 count of recruiters who viewed a Pro developer's profile. */
	public static final String RECRUITER_PROFILE_VIEW = "RECRUITER_PROFILE_VIEW";
	public static final String JOB_SEEKING_OFF = "JOB_SEEKING_OFF";
	public static final String MESSAGE_REQUEST = "MESSAGE_REQUEST";
	public static final String TEAM_INVITE = "TEAM_INVITE";
	public static final String REPORT_AUTO_HIDDEN = "REPORT_AUTO_HIDDEN";
	public static final String REPORT_OUTCOME = "REPORT_OUTCOME";
	public static final String JOB_AD_ENDED = "JOB_AD_ENDED";
	public static final String MARKETING = "MARKETING";
	/** Page 17 AI summary finished (POL-C-5). Links to the result sheet. */
	public static final String AI_SUMMARY_DONE = "AI_SUMMARY_DONE";
	/** Page 17 AI summary could not be made; the daily count was given back. */
	public static final String AI_SUMMARY_FAILED = "AI_SUMMARY_FAILED";

	private NotificationTypes() {
	}

	/** Chat notifications skip quiet hours and are pushed by the chat delivery job. */
	public static boolean isChat(String type) {
		return CHAT.equals(type) || CHAT_MENTION.equals(type);
	}

	/**
	 * POL-N-1 quiet hours do not hold these: chat, and the result of an AI summary the person just asked
	 * for. AI summary rows still go out through the non-chat push job.
	 */
	public static boolean skipsQuietHours(String type) {
		return isChat(type) || AI_SUMMARY_DONE.equals(type) || AI_SUMMARY_FAILED.equals(type);
	}
}
