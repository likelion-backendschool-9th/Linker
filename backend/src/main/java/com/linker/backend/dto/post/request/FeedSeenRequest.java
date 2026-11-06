package com.linker.backend.dto.post.request;

import java.util.List;

public record FeedSeenRequest(List<Long> postIds) {
}
