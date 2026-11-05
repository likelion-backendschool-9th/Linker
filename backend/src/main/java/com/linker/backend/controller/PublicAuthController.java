package com.linker.backend.controller;

import com.linker.backend.global.security.SessionCookies;
import com.linker.backend.service.PublicAuthService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
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

	private final PublicAuthService auth;
	private final SessionCookies cookies;

	public PublicAuthController(PublicAuthService auth, SessionCookies cookies) {
		this.auth = auth;
		this.cookies = cookies;
	}

	@PostMapping("/auth/refresh")
	@Tag(name = "p00-common")
	@Operation(operationId = "refreshSession")
	@ApiResponse(responseCode = "204", description = "Session cookie replaced")
	public ResponseEntity<Void> refresh(HttpServletRequest request, HttpServletResponse response) {
		String token = cookies.read(request);
		String renewed = auth.refresh(token);
		response.addHeader(HttpHeaders.SET_COOKIE, cookies.write(renewed));
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}
}
