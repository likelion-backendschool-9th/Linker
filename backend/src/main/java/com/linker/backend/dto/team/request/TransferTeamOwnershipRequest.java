package com.linker.backend.dto.team.request;
import jakarta.validation.constraints.Positive;
public record TransferTeamOwnershipRequest(@io.swagger.v3.oas.annotations.media.Schema(requiredMode=io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED) @Positive long toUserId) {}
