package com.linker.backend.dto.auth.request;

public record GithubCallbackRequest(String code, String state, String returnTo) {
}
