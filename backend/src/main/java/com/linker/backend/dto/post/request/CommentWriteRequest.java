package com.linker.backend.dto.post.request;

/** Flat comments only — replies are out of MVP (POL-P-5). */
public record CommentWriteRequest(String text) {
}
