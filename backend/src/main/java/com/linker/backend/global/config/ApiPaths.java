package com.linker.backend.global.config;

/**
 * URL paths that security code matches by string. {@code WebConfig} adds {@link #PREFIX} to controllers,
 * so these constants are the only other place the version appears.
 */
public final class ApiPaths {

	public static final String PREFIX = "/api/v1";

	public static final String PUBLIC = PREFIX + "/public";
	public static final String USER = PREFIX + "/user";
	public static final String RECRUITER = PREFIX + "/recruiter";
	public static final String ADMIN = PREFIX + "/admin";
	/** Served by {@code GithubWebhookController}, outside the controller package prefix. */
	public static final String WEBHOOK = PREFIX + "/webhook";

	public static final String AUTH_REFRESH = PUBLIC + "/auth/refresh";
	public static final String AUTH_LOGOUT = USER + "/auth/logout";
	public static final String WITHDRAWAL = USER + "/me/withdrawal";
	public static final String APPEALS = USER + "/appeals";
	public static final String ADMIN_OTP_VERIFY = ADMIN + "/otp/verify";

	private ApiPaths() {
	}
}
