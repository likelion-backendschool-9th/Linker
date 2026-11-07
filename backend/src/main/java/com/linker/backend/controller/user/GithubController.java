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
@RequestMapping("/user")
public class GithubController {
	private final GithubService github;
	public GithubController(GithubService github) { this.github = github; }

	@GetMapping("/team-setup/install-url")
	@Tag(name = "p00-common")
	@Operation(operationId = "getInstallUrl")
	@DeveloperOnly
	public ResponseEntity<InstallUrlResponse> installUrl(@AuthenticationPrincipal AuthenticatedUser user) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(github.installUrl(user));
	}

	@PostMapping("/team-setup/installations/verify")
	@Tag(name = "p00-common")
	@Operation(operationId = "verifyInstallation")
	@DeveloperOnly
	public ResponseEntity<VerifyInstallationResponse> verify(@AuthenticationPrincipal AuthenticatedUser user,
			@Valid @RequestBody VerifyInstallationRequest request) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(github.verify(user, request));
	}

	@GetMapping("/chat-rooms/{roomId}/pull-requests")
	@Tag(name = "p17-chat-room")
	@Operation(operationId = "listChatPullRequests")
	@DeveloperOnly
	public ResponseEntity<com.linker.backend.dto.github.response.ChatPullRequestsResponse> pullRequests(
			@AuthenticationPrincipal AuthenticatedUser user,
			@org.springframework.web.bind.annotation.PathVariable long roomId,
			@org.springframework.web.bind.annotation.RequestParam(defaultValue = "open") String state) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(github.pullRequests(user, roomId, state));
	}
}
