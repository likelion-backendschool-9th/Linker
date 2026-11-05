package com.linker.backend.dto.auth.response;

public record GithubAuthorizeResponse(String authorizeUrl, String state) {
}
