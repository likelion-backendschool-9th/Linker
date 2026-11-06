package com.linker.backend.dto.github.response;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(requiredProperties={"result","org","installationId","teamId"})
public record VerifyInstallationResponse(@Schema(allowableValues={"INSTALLED","REQUESTED_FROM_OWNER","ALREADY_LINKED"}) String result,
        @Schema(nullable=true) Organization org, @Schema(nullable=true) String installationId, @Schema(nullable=true) Long teamId) {
	public VerifyInstallationResponse(String result, Organization org, String installationId){this(result,org,installationId,null);}
	public record Organization(long id, String login, String avatarUrl) {
	}
}
