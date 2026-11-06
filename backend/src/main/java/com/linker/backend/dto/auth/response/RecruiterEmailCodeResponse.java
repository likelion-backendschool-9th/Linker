package com.linker.backend.dto.auth.response;

public record RecruiterEmailCodeResponse(boolean sent, int resendAfterSeconds, int validMinutes) {
}
