package com.linker.backend.controller.user;

import com.linker.backend.dto.post.request.PostWriteRequest;
import com.linker.backend.dto.post.response.EditorRepoListResponse;
import com.linker.backend.dto.post.response.PostEditFormResponse;
import com.linker.backend.dto.post.response.PostIdResponse;
import com.linker.backend.dto.post.response.RepoSummaryResponse;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.DeveloperOnly;
import com.linker.backend.global.security.RateLimit;
import com.linker.backend.service.user.UserPostService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/user")
@Tag(name = "p22-post-editor")
public class UserPostController {

	private final UserPostService posts;

	public UserPostController(UserPostService posts) {
		this.posts = posts;
	}

	@GetMapping("/post-editor/repos")
	@DeveloperOnly
	@Operation(tags = {"p22-post-editor"})
	public ResponseEntity<EditorRepoListResponse> listRepos(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestParam(required = false) String q,
			@RequestParam(required = false) Long teamId
	) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(posts.listRepos(user, q, teamId));
	}

	@GetMapping("/post-editor/repos/{repoId}/summary")
	@DeveloperOnly
	@Operation(tags = {"p22-post-editor"})
	public ResponseEntity<RepoSummaryResponse> repoSummary(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long repoId
	) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(posts.repoSummary(user, repoId));
	}

	@PostMapping("/posts")
	@DeveloperOnly
	@RateLimit(
			key = "post.create",
			permits = PlanLimits.POSTS_PER_DAY,
			windowSeconds = PlanLimits.POSTS_PER_DAY_WINDOW_SECONDS
	)
	@Operation(tags = {"p22-post-editor"})
	public ResponseEntity<PostIdResponse> create(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody PostWriteRequest request
	) {
		return ResponseEntity.status(HttpStatus.CREATED)
				.cacheControl(CacheControl.noStore())
				.body(posts.create(user, request));
	}

	@GetMapping("/posts/{postId}/edit-form")
	@DeveloperOnly
	@Operation(tags = {"p22-post-editor"})
	public ResponseEntity<PostEditFormResponse> editForm(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long postId
	) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(posts.editForm(user, postId));
	}

	@PutMapping("/posts/{postId}")
	@DeveloperOnly
	@Operation(tags = {"p22-post-editor"})
	public ResponseEntity<PostIdResponse> update(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long postId,
			@RequestBody PostWriteRequest request
	) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(posts.update(user, postId, request));
	}
}
