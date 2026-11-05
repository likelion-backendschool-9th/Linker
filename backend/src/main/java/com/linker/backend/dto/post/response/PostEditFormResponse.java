package com.linker.backend.dto.post.response;

import java.util.List;

public record PostEditFormResponse(
		long id,
		String intro,
		String body,
		List<PostPhotoResponse> photos,
		String myRole,
		List<String> demoLinks,
		PostPeriodResponse period,
		Integer teamSize,
		List<String> tags,
		RepoSummaryResponse repo,
		int photoLimit
) {
}
