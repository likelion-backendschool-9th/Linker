package com.linker.backend.dto.auth.request;

public record RecruiterPasswordUpdateRequest(String currentPassword, String newPassword) {
}
