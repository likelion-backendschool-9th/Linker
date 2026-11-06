package com.linker.backend.dto.auth.request;

public record RecruiterEmailCodeVerifyRequest(String email, String code) {
}
