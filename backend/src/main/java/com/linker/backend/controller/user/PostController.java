package com.linker.backend.controller.user;

import com.linker.backend.dto.post.request.CommentWriteRequest;
import com.linker.backend.dto.post.request.FeedSeenRequest;
import com.linker.backend.dto.post.request.PinPostsRequest;
import com.linker.backend.dto.post.request.PostWriteRequest;
import com.linker.backend.dto.post.response.CommentResponse;
import com.linker.backend.dto.post.response.EditorRepoListResponse;
import com.linker.backend.dto.post.response.LikeCountResponse;
import com.linker.backend.dto.post.response.LikerListResponse;
import com.linker.backend.dto.post.response.PinnedPostsResponse;
import com.linker.backend.dto.post.response.PostEditFormResponse;
import com.linker.backend.dto.post.response.PostIdResponse;
import com.linker.backend.dto.post.response.RecommendedUsersResponse;
import com.linker.backend.dto.post.response.RepoSummaryResponse;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.DeveloperOnly;
import com.linker.backend.global.security.RateLimit;
import com.linker.backend.service.user.PostService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController("userPostController")
@RequestMapping("/user")
@Tag(name = "p22-post-editor")
@Tag(name = "p23-post-detail")
@Tag(name = "p24-feed")
public class PostController {

	private final PostService posts;

	public PostController(PostService posts) {
		this.posts = posts;
	}

	@PostMapping("/feed/seen")
	@Operation(tags = {"p24-feed"})
	public ResponseEntity<Void> markSeen(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody(required = false) FeedSeenRequest request
	) {
		posts.markSeen(user, request);
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}

	@GetMapping("/feed/recommended-users")
	@Operation(tags = {"p24-feed"})
	public ResponseEntity<RecommendedUsersResponse> recommendedUsers(
			@AuthenticationPrincipal AuthenticatedUser user
	) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(posts.recommendedUsers(user));
	}

	@PutMapping("/me/pinned-posts")
	@DeveloperOnly
	@Operation(operationId = "replacePinnedPosts", tags = {"p04-profile"})
	public ResponseEntity<PinnedPostsResponse> replacePins(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody PinPostsRequest request
	) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(posts.replacePins(user, request));
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

	@PostMapping("/posts/{postId}/likes")
	@DeveloperOnly
	@Operation(tags = {"p23-post-detail"})
	public ResponseEntity<LikeCountResponse> like(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long postId
	) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(posts.like(user, postId));
	}

	@DeleteMapping("/posts/{postId}/likes")
	@DeveloperOnly
	@Operation(tags = {"p23-post-detail"})
	public ResponseEntity<LikeCountResponse> unlike(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long postId
	) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(posts.unlike(user, postId));
	}

	@GetMapping("/posts/{postId}/likes")
	@Operation(tags = {"p23-post-detail"})
	public ResponseEntity<LikerListResponse> likers(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long postId,
			@RequestParam(required = false) String cursor
	) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(posts.likers(user, postId, cursor));
	}

	@PostMapping("/posts/{postId}/comments")
	@DeveloperOnly
	@RateLimit(
			key = "post.comment.minute",
			permits = PlanLimits.POST_COMMENTS_PER_MINUTE,
			windowSeconds = PlanLimits.POST_COMMENTS_PER_MINUTE_WINDOW_SECONDS
	)
	@Operation(tags = {"p23-post-detail"})
	public ResponseEntity<CommentResponse> createComment(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long postId,
			@RequestBody CommentWriteRequest request
	) {
		return ResponseEntity.status(HttpStatus.CREATED)
				.cacheControl(CacheControl.noStore())
				.body(posts.createComment(user, postId, request));
	}

	@PatchMapping("/posts/{postId}/comments/{commentId}")
	@DeveloperOnly
	@Operation(tags = {"p23-post-detail"})
	public ResponseEntity<CommentResponse> updateComment(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long postId,
			@PathVariable long commentId,
			@RequestBody CommentWriteRequest request
	) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(posts.updateComment(user, postId, commentId, request));
	}

	@DeleteMapping("/posts/{postId}/comments/{commentId}")
	@DeveloperOnly
	@Operation(tags = {"p23-post-detail"})
	public ResponseEntity<Void> deleteComment(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long postId,
			@PathVariable long commentId
	) {
		posts.deleteComment(user, postId, commentId);
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}

	@DeleteMapping("/posts/{postId}")
	@DeveloperOnly
	@Operation(tags = {"p23-post-detail"})
	public ResponseEntity<Void> deletePost(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long postId
	) {
		posts.deletePost(user, postId);
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}
}
