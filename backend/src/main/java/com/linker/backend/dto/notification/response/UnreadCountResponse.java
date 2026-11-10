package com.linker.backend.dto.notification.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

public record UnreadCountResponse(@Schema(requiredMode = REQUIRED) long count) {
}
