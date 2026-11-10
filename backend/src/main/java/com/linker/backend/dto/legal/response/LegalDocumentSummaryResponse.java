package com.linker.backend.dto.legal.response;

public record LegalDocumentSummaryResponse(
		String slug,
		String title,
		String version,
		String effectiveDate
) {
}
