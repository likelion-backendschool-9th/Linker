package com.linker.backend.controller;

import com.linker.backend.dto.post.response.CommentListResponse;
import com.linker.backend.dto.post.response.FeedPostItemResponse;
import com.linker.backend.dto.post.response.PostCardListResponse;
import com.linker.backend.dto.post.response.PostDetailResponse;
import com.linker.backend.dto.post.response.PostReadmeResponse;
import com.linker.backend.dto.recruit.response.CursorPage;
import com.linker.backend.service.PublicPostService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public")
@Tag(name = "p23-post-detail")
@Tag(name = "p24-feed")
public class PublicPostController {

	private final PublicPostService posts;

	public PublicPostController(PublicPostService posts) {
		this.posts = posts;
	}

	@GetMapping("/feed")
	@Operation(tags = {"p24-feed"})
	public ResponseEntity<CursorPage<FeedPostItemResponse>> feed(
			@RequestParam(required = false) String cursor,
			@RequestParam(required = false) Boolean offersOnly
	) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(posts.feed(cursor, offersOnly));
	}

	@GetMapping("/posts/{postId}")
	@Operation(tags = {"p23-post-detail"})
	public ResponseEntity<PostDetailResponse> detail(
			@PathVariable long postId,
			@RequestParam(required = false) String from
	) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(posts.detail(postId, from));
	}

	@GetMapping("/posts/{postId}/readme")
	@Operation(tags = {"p23-post-detail"})
	public ResponseEntity<PostReadmeResponse> readme(@PathVariable long postId) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(posts.readme(postId));
	}

	@GetMapping("/posts/{postId}/comments")
	@Operation(tags = {"p23-post-detail"})
	public ResponseEntity<CommentListResponse> comments(@PathVariable long postId) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(posts.comments(postId));
	}

	@GetMapping("/posts/{postId}/same-repo-posts")
	@Operation(tags = {"p23-post-detail"})
	public ResponseEntity<PostCardListResponse> sameRepoPosts(@PathVariable long postId) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(posts.sameRepoPosts(postId));
	}
}
