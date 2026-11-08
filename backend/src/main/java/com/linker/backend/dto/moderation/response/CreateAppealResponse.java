package com.linker.backend.dto.moderation.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

public record CreateAppealResponse(@Schema(requiredMode = REQUIRED) long appealId) {
}
