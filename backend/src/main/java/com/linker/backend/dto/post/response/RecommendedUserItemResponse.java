package com.linker.backend.dto.post.response;

import java.util.List;

import com.linker.backend.dto.recruit.response.AuthorBriefResponse;

public record RecommendedUserItemResponse(
		AuthorBriefResponse user,
		List<String> techStack
) {
}
