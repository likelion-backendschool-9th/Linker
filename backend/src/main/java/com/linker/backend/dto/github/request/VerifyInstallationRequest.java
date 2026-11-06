package com.linker.backend.dto.github.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record VerifyInstallationRequest(
		@Pattern(regexp = "[0-9]{1,19}") String installationId,
		@NotBlank @Size(max = 128) String state,
		@Pattern(regexp = "install|update|request") String setupAction
) {
}
