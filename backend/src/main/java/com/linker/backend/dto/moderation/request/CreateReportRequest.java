package com.linker.backend.dto.moderation.request;

public record CreateReportRequest(String targetType, Object targetId, String reason, String detail) {
}
