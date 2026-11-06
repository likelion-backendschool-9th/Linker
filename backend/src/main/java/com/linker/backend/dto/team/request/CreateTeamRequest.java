package com.linker.backend.dto.team.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateTeamRequest(
    @NotBlank @Pattern(regexp = "[0-9]{1,19}") String installationId,
    @NotBlank @Size(max = 255) String name,
    String description) {}
