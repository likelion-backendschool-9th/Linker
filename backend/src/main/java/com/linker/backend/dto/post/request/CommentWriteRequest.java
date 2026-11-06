package com.linker.backend.dto.post.request;

public record CommentWriteRequest(
		String text,
		Long parentId
) {
}
