package com.linker.backend.controller.recruiter;

import com.linker.backend.dto.account.request.RecruiterProfileUpdateRequest;
import com.linker.backend.dto.account.response.RecruiterProfileResponse;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.service.recruiter.RecruiterAccountService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/recruiter/me/profile")
public class RecruiterAccountController {

	private final RecruiterAccountService accounts;

	public RecruiterAccountController(RecruiterAccountService accounts) {
		this.accounts = accounts;
	}

	@GetMapping
	@Tag(name = "p05-profile-edit")
	@Operation(operationId = "getRecruiterProfile")
	public ResponseEntity<RecruiterProfileResponse> profile(@AuthenticationPrincipal AuthenticatedUser user) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(accounts.profile(user));
	}

	@PatchMapping
	@Tag(name = "p05-profile-edit")
	@Operation(operationId = "updateRecruiterProfile")
	public ResponseEntity<RecruiterProfileResponse> update(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody RecruiterProfileUpdateRequest request) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(accounts.update(user, request));
	}
}
