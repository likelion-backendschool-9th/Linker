package com.linker.backend.dto.team.request;

import jakarta.validation.constraints.*;

public record NotifyTeamInviteRequest(
    @NotBlank @Size(max = 255) String handle, @NotBlank @Size(max = 128) String code) {}
