package com.linker.backend.dto.chat.response;

public record UnreadSummaryResponse(
		long TEAM,
		long DIRECT,
		long REQUEST,
		long requestCount,
		long total
) {
}
