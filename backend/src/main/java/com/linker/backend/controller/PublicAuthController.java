package com.linker.backend.controller;

import com.linker.backend.dto.auth.request.GithubCallbackRequest;
import com.linker.backend.dto.auth.response.GithubAuthorizeResponse;
import com.linker.backend.dto.auth.response.GithubCallbackResponse;
import com.linker.backend.global.config.LinkerProperties;
import com.linker.backend.global.security.ClientAddress;
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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public")
public class PublicAuthController {

	private final PublicAuthService auth;
	private final SessionCookies cookies;
	private final LinkerProperties properties;

	public PublicAuthController(PublicAuthService auth, SessionCookies cookies, LinkerProperties properties) {
		this.auth = auth;
		this.cookies = cookies;
		this.properties = properties;
	}

	@GetMapping("/auth/github/authorize-url")
	@Tag(name = "p01-login")
	@Operation(operationId = "githubAuthorizeUrl")
	public ResponseEntity<GithubAuthorizeResponse> authorize(
			@RequestParam String client,
			@RequestParam(required = false) String returnTo) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(auth.authorize(client, returnTo));
	}

	@PostMapping("/auth/github/callback")
	@Tag(name = "p01-login")
	@Operation(operationId = "githubCallback")
	public ResponseEntity<GithubCallbackResponse> callback(
			@RequestBody GithubCallbackRequest body,
			HttpServletRequest request,
			HttpServletResponse response) {
		PublicAuthService.GithubLogin login = auth.callback(
				body.code(),
				body.state(),
				request.getHeader(HttpHeaders.USER_AGENT),
				ClientAddress.ip(request, properties.security().trustForwardedFor()));
		response.addHeader(HttpHeaders.SET_COOKIE, cookies.write(login.rawToken()));
		return ResponseEntity.ok().cacheControl(CacheControl.noStore())
				.body(new GithubCallbackResponse(login.isNew(), login.restored(), login.returnTo()));
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
