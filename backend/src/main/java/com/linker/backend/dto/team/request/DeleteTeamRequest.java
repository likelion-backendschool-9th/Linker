package com.linker.backend.dto.team.request;

import jakarta.validation.constraints.NotBlank;

public record DeleteTeamRequest(@NotBlank String confirmName) {}
