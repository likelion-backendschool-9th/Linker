package com.linker.backend.controller.public_;

import com.linker.backend.global.security.SessionCookies;
import com.linker.backend.service.auth.SessionService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public")
public class PublicAuthController {

	private final SessionService sessions;
	private final SessionCookies cookies;

	public PublicAuthController(SessionService sessions, SessionCookies cookies) {
		this.sessions = sessions;
		this.cookies = cookies;
	}

	@PostMapping("/auth/refresh")
	public ResponseEntity<Void> refresh(HttpServletRequest request, HttpServletResponse response) {
		String token = cookies.read(request);
		sessions.extendNow(token);
		response.addHeader(HttpHeaders.SET_COOKIE, cookies.write(token));
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}
}
