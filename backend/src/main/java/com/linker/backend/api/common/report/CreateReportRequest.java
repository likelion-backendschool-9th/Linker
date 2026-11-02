package com.linker.backend.api.common.report;

public record CreateReportRequest(String targetType, Object targetId, String reason, String detail) {
}
