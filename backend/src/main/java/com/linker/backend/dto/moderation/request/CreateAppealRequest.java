package com.linker.backend.dto.moderation.request;

public record CreateAppealRequest(Long sanctionId, String body) {
}
