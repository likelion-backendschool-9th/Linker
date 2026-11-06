package com.linker.backend.controller.user;

import com.linker.backend.dto.github.request.VerifyInstallationRequest;
import com.linker.backend.dto.github.response.InstallUrlResponse;
import com.linker.backend.dto.github.response.VerifyInstallationResponse;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.DeveloperOnly;
import com.linker.backend.service.user.GithubService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController("userGithubController")
@RequestMapping("/user/team-setup")
public class GithubController {
	private final GithubService github;
	public GithubController(GithubService github) { this.github = github; }

	@GetMapping("/install-url")
	@Tag(name = "p00-common")
	@Operation(operationId = "getInstallUrl")
	@DeveloperOnly
	public ResponseEntity<InstallUrlResponse> installUrl(@AuthenticationPrincipal AuthenticatedUser user) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(github.installUrl(user));
	}

	@PostMapping("/installations/verify")
	@Tag(name = "p00-common")
	@Operation(operationId = "verifyInstallation")
	@DeveloperOnly
	public ResponseEntity<VerifyInstallationResponse> verify(@AuthenticationPrincipal AuthenticatedUser user,
			@Valid @RequestBody VerifyInstallationRequest request) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(github.verify(user, request));
	}
}
