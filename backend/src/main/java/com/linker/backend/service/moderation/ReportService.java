package com.linker.backend.service.moderation;

import java.time.Instant;
import java.util.List;

import com.linker.backend.entity.moderation.Report;
import com.linker.backend.entity.moderation.ReportCase;
import com.linker.backend.entity.moderation.ReportReason;
import com.linker.backend.entity.moderation.ReportTargetType;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.repository.moderation.ReportCaseOpener;
import com.linker.backend.repository.moderation.ReportCaseRepository;
import com.linker.backend.repository.moderation.ReportRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReportService {

	private final ReportCaseRepository cases;
	private final ReportCaseOpener caseOpener;
	private final ReportRepository reports;
	private final List<ReportTargetResolver> resolvers;
	private final ReportVisibilitySink visibility;
	private final ChatReportSnapshotter snapshots;

	public ReportService(
			ReportCaseRepository cases,
			ReportCaseOpener caseOpener,
			ReportRepository reports,
			List<ReportTargetResolver> resolvers,
			ReportVisibilitySink visibility,
			ChatReportSnapshotter snapshots
	) {
		this.cases = cases;
		this.caseOpener = caseOpener;
		this.reports = reports;
		this.resolvers = resolvers;
		this.visibility = visibility;
		this.snapshots = snapshots;
	}

	@Transactional
	public void report(long reporterId, String targetType, Object targetId, String reason, String detail) {
		ReportTargetType type = parseType(targetType);
		ReportReason reportReason = parseReason(reason);
		String normalizedDetail = normalizeDetail(reportReason, detail);
		long parsedTargetId = parseTargetId(targetId);
		ReportTargetResolver.ResolvedTarget target = resolvers.stream()
				.filter(resolver -> resolver.supports() == type)
				.findFirst()
				.flatMap(resolver -> resolver.resolve(parsedTargetId))
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "신고할 대상을 찾을 수 없어요"));
		if (target.targetUserId() == reporterId) {
			throw new ApiException(400, "VALIDATION_ERROR", "본인은 신고할 수 없어요");
		}
		long caseId = caseOpener.openPending(type, parsedTargetId, target.targetUserId());
		ReportCase reportCase = cases.lockById(caseId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "신고할 대상을 찾을 수 없어요"));
		if (reports.existsByReportCase_IdAndReporterId(reportCase.getId(), reporterId)) {
			return;
		}
		Report saved = reports.saveAndFlush(Report.create(reportCase, reporterId, reportReason, normalizedDetail));
		int count = (int) reports.countByReportCase_Id(reportCase.getId());
		reportCase.changeReporterCount(count);
		if (count >= PlanLimits.REPORT_AUTO_HIDE_REPORTERS && reportCase.getAutoHiddenAt() == null) {
			reportCase.markAutoHidden(Instant.now());
			visibility.hideTarget(type, parsedTargetId);
		}
		if (type == ReportTargetType.TEAM_MESSAGE || type == ReportTargetType.DM_MESSAGE) {
			snapshots.capture(saved.getId(), parsedTargetId);
		}
	}

	private String normalizeDetail(ReportReason reason, String detail) {
		String trimmed = detail == null ? "" : detail.trim();
		if (trimmed.length() > PlanLimits.REPORT_DETAIL_MAX_CHARS) {
			throw new ApiException(400, "VALIDATION_ERROR", "신고 내용을 확인해 주세요");
		}
		if (reason == ReportReason.OTHER && trimmed.isEmpty()) {
			throw new ApiException(400, "VALIDATION_ERROR", "기타 사유를 적어 주세요.");
		}
		return trimmed.isEmpty() ? null : trimmed;
	}

	private long parseTargetId(Object raw) {
		if (raw instanceof Number number) {
			return number.longValue();
		}
		if (raw instanceof String text && text.matches("[0-9]+")) {
			return Long.parseLong(text);
		}
		throw new ApiException(400, "VALIDATION_ERROR", "신고 대상을 확인해 주세요");
	}

	private ReportTargetType parseType(String raw) {
		if (raw == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "신고 대상을 확인해 주세요");
		}
		try {
			return ReportTargetType.valueOf(raw);
		}
		catch (IllegalArgumentException exception) {
			throw new ApiException(400, "VALIDATION_ERROR", "신고 대상을 확인해 주세요");
		}
	}

	private ReportReason parseReason(String raw) {
		if (raw == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "신고 사유를 골라 주세요.");
		}
		try {
			return ReportReason.valueOf(raw);
		}
		catch (IllegalArgumentException exception) {
			throw new ApiException(400, "VALIDATION_ERROR", "신고 사유를 골라 주세요.");
		}
	}
}
