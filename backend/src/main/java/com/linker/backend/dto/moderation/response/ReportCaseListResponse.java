package com.linker.backend.dto.moderation.response;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record ReportCaseListResponse(List<ReportCaseView> items) {

	public record ReportCaseView(
			long id,
			String status,
			String targetType,
			String targetSummary,
			List<ReasonCount> reasons,
			int reporterCount,
			boolean autoHidden,
			Instant receivedAt,
			boolean overdue,
			Person target,
			List<ChatLine> chatContext,
			String handledAction,
			JobAd jobAd
	) {
	}

	/** Present when the reported target is a job ad. The host is shown; the full posting URL is not. */
	public record JobAd(
			String company,
			String title,
			String jobCategory,
			LocalDate closesOn,
			String urlHost
	) {
	}

	public record ReasonCount(String reason, int count) {
	}

	public record Person(
			long id,
			String login,
			String name,
			String avatarUrl,
			String userType,
			String jobStatus
	) {
	}

	public record ChatLine(String sender, String text, boolean reported) {
	}
}
