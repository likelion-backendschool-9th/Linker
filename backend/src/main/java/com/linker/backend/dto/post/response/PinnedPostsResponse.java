package com.linker.backend.dto.post.response;

import java.util.List;

public record PinnedPostsResponse(List<Long> pinnedPostIds) {
}
