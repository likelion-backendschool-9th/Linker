package com.linker.backend.dto.recruit.response;

import java.util.List;

public record RecruitEditorOptionsResponse(
		List<TeamOptionResponse> teams,
		int openCount,
		int openLimit,
		String maxDeadlineDate
) {
}
