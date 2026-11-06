package com.linker.backend.controller;

import com.linker.backend.dto.auth.request.GithubCallbackRequest;
import com.linker.backend.dto.auth.request.RecruiterEmailCodeRequest;
import com.linker.backend.dto.auth.request.RecruiterEmailCodeVerifyRequest;
import com.linker.backend.dto.auth.request.RecruiterLoginRequest;
import com.linker.backend.dto.auth.request.RecruiterPasswordChangeRequest;
import com.linker.backend.dto.auth.request.RecruiterPasswordResetRequest;
import com.linker.backend.dto.auth.request.RecruiterSignupRequest;
import com.linker.backend.dto.auth.response.GithubAuthorizeResponse;
import com.linker.backend.dto.auth.response.GithubCallbackResponse;
import com.linker.backend.dto.auth.response.RecruiterEmailCodeResponse;
import com.linker.backend.dto.auth.response.RecruiterEmailCodeVerifyResponse;
import com.linker.backend.dto.auth.response.RecruiterLoginResponse;
import com.linker.backend.dto.auth.response.RecruiterPasswordResetResponse;
import com.linker.backend.dto.auth.response.RecruiterPasswordResetStatusResponse;
import com.linker.backend.dto.auth.response.RecruiterSignupResponse;
import com.linker.backend.service.PublicAuthService.RecruiterAccountCreated;
import com.linker.backend.service.PublicAuthService.RecruiterAuthenticated;
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
import org.springframework.web.bind.annotation.PathVariable;
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

	@PostMapping("/recruiter-signup/email-codes")
	@Tag(name = "p31-recruiter-signup")
	@Operation(operationId = "requestRecruiterEmailCode")
	public ResponseEntity<RecruiterEmailCodeResponse> requestRecruiterCode(@RequestBody RecruiterEmailCodeRequest body) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(auth.requestRecruiterCode(body));
	}

	@PostMapping("/recruiter-signup/email-codes/verify")
	@Tag(name = "p31-recruiter-signup")
	@Operation(operationId = "verifyRecruiterEmailCode")
	public ResponseEntity<RecruiterEmailCodeVerifyResponse> verifyRecruiterCode(@RequestBody RecruiterEmailCodeVerifyRequest body) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(auth.verifyRecruiterCode(body));
	}

	@PostMapping("/recruiter-signup")
	@Tag(name = "p31-recruiter-signup")
	@Operation(operationId = "createRecruiterAccount")
	public ResponseEntity<RecruiterSignupResponse> createRecruiter(
			@RequestBody RecruiterSignupRequest body,
			HttpServletRequest request,
			HttpServletResponse response) {
		RecruiterAccountCreated created = auth.createRecruiter(body, request.getHeader(HttpHeaders.USER_AGENT), address(request));
		response.addHeader(HttpHeaders.SET_COOKIE, cookies.write(created.rawToken()));
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new RecruiterSignupResponse(created.login()));
	}

	@PostMapping("/recruiter-auth/login")
	@Tag(name = "p32-recruiter-login")
	@Operation(operationId = "loginRecruiter")
	public ResponseEntity<RecruiterLoginResponse> loginRecruiter(
			@RequestBody RecruiterLoginRequest body,
			HttpServletRequest request,
			HttpServletResponse response) {
		RecruiterAuthenticated authenticated = auth.loginRecruiter(body, request.getHeader(HttpHeaders.USER_AGENT), address(request));
		response.addHeader(HttpHeaders.SET_COOKIE, cookies.write(authenticated.rawToken()));
		return ResponseEntity.ok().cacheControl(CacheControl.noStore())
				.body(new RecruiterLoginResponse(authenticated.restored(), authenticated.returnTo()));
	}

	@PostMapping("/recruiter-auth/password-reset-requests")
	@Tag(name = "p32-recruiter-login")
	@Operation(operationId = "requestRecruiterPasswordReset")
	public ResponseEntity<RecruiterPasswordResetResponse> requestRecruiterPasswordReset(@RequestBody RecruiterPasswordResetRequest body) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(auth.requestRecruiterPasswordReset(body));
	}

	@GetMapping("/recruiter-auth/password-reset/{token}")
	@Tag(name = "p32-recruiter-login")
	@Operation(operationId = "getRecruiterPasswordReset")
	public ResponseEntity<RecruiterPasswordResetStatusResponse> recruiterPasswordResetStatus(@PathVariable String token) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(auth.recruiterPasswordResetStatus(token));
	}

	@PostMapping("/recruiter-auth/password-reset")
	@Tag(name = "p32-recruiter-login")
	@Operation(operationId = "resetRecruiterPassword")
	public ResponseEntity<Void> resetRecruiterPassword(@RequestBody RecruiterPasswordChangeRequest body) {
		auth.resetRecruiterPassword(body);
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}

	private String address(HttpServletRequest request) {
		return ClientAddress.ip(request, properties.security().trustForwardedFor());
	}
}
