package com.linker.backend.dto.auth.request;

public record RecruiterPasswordChangeRequest(String token, String newPassword) {
}
