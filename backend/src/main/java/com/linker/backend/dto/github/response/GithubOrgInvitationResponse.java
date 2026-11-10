package com.linker.backend.dto.github.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record GithubOrgInvitationResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean sent,
    @Schema(
            requiredMode = Schema.RequiredMode.REQUIRED,
            allowableValues = {"PENDING", "MEMBER"})
        String status) {}
