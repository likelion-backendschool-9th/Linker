package com.linker.backend.dto.issue.response;

@io.swagger.v3.oas.annotations.media.Schema(requiredProperties = {"refreshedAt", "updatedCount"})
public record IssueRefreshResponse(java.time.Instant refreshedAt, int updatedCount) {}
