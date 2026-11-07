package com.linker.backend.dto.team.request;

import com.linker.backend.entity.team.type.TeamRole;
import jakarta.validation.constraints.NotNull;

public record ChangeTeamRoleRequest(@NotNull TeamRole role) {}
