package com.linker.backend.dto.legal.response;

public record LegalDocumentResponse(
		String slug,
		String title,
		String version,
		String effectiveDate,
		String body
) {
}
