package com.linker.backend.dto.chat.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

/** The other side of a list row: the 1:1 counterpart, or the team itself for a team room. */
public record ChatCounterpartResponse(
		@Schema(requiredMode = REQUIRED, nullable = true, description = "1:1: counterpart avatar (null when withdrawn). TEAM: team photo") String avatarUrl
) {
}
