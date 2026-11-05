package com.linker.backend.dto.post.response;

import java.util.List;

import com.linker.backend.dto.recruit.response.AuthorBriefResponse;

public record PostDetailResponse(
		long id,
		AuthorBriefResponse author,
		String intro,
		String body,
		PostRepoCardResponse repo,
		List<String> photos,
		String myRole,
		List<String> demoLinks,
		PostPeriodResponse period,
		Integer teamSize,
		List<String> tags,
		int likeCount,
		int commentCount,
		int viewCount,
		String visibility,
		String createdAt,
		String editedAt,
		boolean isAuthor,
		boolean likedByMe,
		String trafficSource,
		boolean canSendOffer,
		boolean repoAvailable
) {
}
