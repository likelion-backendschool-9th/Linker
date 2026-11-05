package com.linker.backend.controller;

import com.linker.backend.dto.account.response.PublicProfileResponse;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.service.PublicAccountService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public")
public class PublicAccountController {

	private final PublicAccountService profiles;

	public PublicAccountController(PublicAccountService profiles) {
		this.profiles = profiles;
	}

	@GetMapping("/users/{login}")
	@Tag(name = "p04-profile")
	@Operation(operationId = "getPublicProfile")
	public ResponseEntity<PublicProfileResponse> profile(
			@PathVariable String login,
			@AuthenticationPrincipal AuthenticatedUser viewer) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(profiles.profile(login, viewer));
	}
}
