package com.linker.backend.dto.post.response;

public record FeedPostItemResponse(
		String type,
		PostCardResponse post,
		String whyShown
) {
	public static FeedPostItemResponse of(PostCardResponse post, String whyShown) {
		return new FeedPostItemResponse("POST", post, whyShown);
	}
}
