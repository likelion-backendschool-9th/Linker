package com.linker.backend.dto.subscription.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

public record TeamCandidatesResponse(@Schema(requiredMode = REQUIRED) List<TeamCandidateResponse> items) {
}
