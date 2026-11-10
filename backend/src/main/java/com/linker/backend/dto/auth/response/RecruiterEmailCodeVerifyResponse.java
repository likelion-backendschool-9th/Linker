package com.linker.backend.dto.auth.response;

public record RecruiterEmailCodeVerifyResponse(String signupToken, String emailDomain) {
}
