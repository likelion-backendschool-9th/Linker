package com.linker.backend.dto.auth.response;

public record GithubCallbackResponse(boolean isNew, boolean restored, String returnTo) {
}
