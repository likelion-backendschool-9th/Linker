package com.linker.backend.global.security;

import java.time.Duration;

import com.linker.backend.global.config.LinkerProperties;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class SessionCookies {

	private final LinkerProperties.Session session;

	public SessionCookies(LinkerProperties properties) {
		this.session = properties.session();
	}

	public String read(HttpServletRequest request) {
		Cookie[] cookies = request.getCookies();
		if (cookies == null) {
			return null;
		}
		for (Cookie cookie : cookies) {
			if (session.cookieName().equals(cookie.getName())) {
				return cookie.getValue();
			}
		}
		return null;
	}

	public String write(String token) {
		ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(session.cookieName(), token)
				.httpOnly(true)
				.secure(session.secure())
				.sameSite(session.sameSite())
				.path(session.path())
				.maxAge(Duration.ofDays(session.lifetimeDays()));
		if (session.domain() != null && !session.domain().isBlank()) {
			builder.domain(session.domain());
		}
		return builder.build().toString();
	}

	public String clear() {
		ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(session.cookieName(), "")
				.httpOnly(true)
				.secure(session.secure())
				.sameSite(session.sameSite())
				.path(session.path())
				.maxAge(0);
		if (session.domain() != null && !session.domain().isBlank()) {
			builder.domain(session.domain());
		}
		return builder.build().toString();
	}
}
