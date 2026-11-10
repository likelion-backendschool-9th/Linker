package com.linker.backend.dto.post.response;

import java.util.List;

public record LikerListResponse(
		List<LikerItemResponse> items,
		String nextCursor
) {
}
