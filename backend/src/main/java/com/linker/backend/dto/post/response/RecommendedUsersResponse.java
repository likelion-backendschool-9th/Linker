package com.linker.backend.dto.post.response;

import java.util.List;

public record RecommendedUsersResponse(List<RecommendedUserItemResponse> items) {
}
