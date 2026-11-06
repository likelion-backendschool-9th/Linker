package com.linker.backend.dto.auth.request;

public record RecruiterLoginRequest(String email, String password, String returnTo) {
}
