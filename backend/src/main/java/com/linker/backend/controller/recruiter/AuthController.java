package com.linker.backend.controller.recruiter;

import com.linker.backend.dto.auth.request.RecruiterPasswordUpdateRequest;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.service.recruiter.AuthService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController("recruiterAuthController")
@RequestMapping("/recruiter/me")
public class AuthController {

	private final AuthService auth;

	public AuthController(AuthService auth) {
		this.auth = auth;
	}

	@PatchMapping("/password")
	@Tag(name = "p06-settings")
	@Operation(operationId = "changeRecruiterPassword")
	@ApiResponse(responseCode = "204", description = "Password changed and other sessions ended")
	public ResponseEntity<Void> changePassword(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody RecruiterPasswordUpdateRequest request) {
		auth.changePassword(user, request);
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}
}
