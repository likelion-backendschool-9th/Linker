package com.linker.backend.dto.team.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Team.name is varchar(255) in the existing ERD; description is text. */
public record UpdateTeamRequest(@NotBlank @Size(max = 255) String name, String description, Boolean aiSummaryEnabled) {}
