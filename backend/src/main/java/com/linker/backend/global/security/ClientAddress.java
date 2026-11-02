package com.linker.backend.global.security;

import jakarta.servlet.http.HttpServletRequest;

public final class ClientAddress {

	private ClientAddress() {
	}

	public static String ip(HttpServletRequest request, boolean trustForwardedFor) {
		if (trustForwardedFor) {
			String forwarded = request.getHeader("X-Forwarded-For");
			if (forwarded != null && !forwarded.isBlank()) {
				String first = forwarded.split(",")[0].trim();
				if (!first.isEmpty()) {
					return first;
				}
			}
		}
		return request.getRemoteAddr();
	}
}
