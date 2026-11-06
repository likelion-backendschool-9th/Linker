package com.linker.backend.dto.post.request;

import java.util.List;

public record PostWriteRequest(
		Long repoId,
		String intro,
		String body,
		List<PostPhotoRequest> photos,
		String myRole,
		List<String> demoLinks,
		PostPeriodRequest period,
		Integer teamSize,
		List<String> tags
) {
}
