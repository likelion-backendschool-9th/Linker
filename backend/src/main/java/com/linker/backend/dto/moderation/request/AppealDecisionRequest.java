package com.linker.backend.dto.moderation.request;

public record AppealDecisionRequest(Boolean accept, String reason) {
}
