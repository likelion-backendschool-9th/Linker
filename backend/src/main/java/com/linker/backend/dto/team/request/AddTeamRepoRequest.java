package com.linker.backend.dto.team.request;

import jakarta.validation.constraints.Positive;

/** GitHub repository ID, matching page 08 repository selection. */
public record AddTeamRepoRequest(@Positive long repoId) {}
