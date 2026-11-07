package com.linker.backend.service.admin;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.linker.backend.dto.moderation.request.AppealDecisionRequest;
import com.linker.backend.dto.moderation.request.OtpVerifyRequest;
import com.linker.backend.dto.moderation.request.ReportActionRequest;
import com.linker.backend.dto.moderation.response.AppealListResponse;
import com.linker.backend.dto.moderation.response.AppealListResponse.AppealView;
import com.linker.backend.dto.moderation.response.OtpVerifyResponse;
import com.linker.backend.dto.moderation.response.ReportCaseListResponse;
import com.linker.backend.dto.moderation.response.ReportCaseListResponse.ChatLine;
import com.linker.backend.dto.moderation.response.ReportCaseListResponse.Person;
import com.linker.backend.dto.moderation.response.ReportCaseListResponse.ReasonCount;
import com.linker.backend.dto.moderation.response.ReportCaseListResponse.ReportCaseView;
import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.entity.account.type.JobSeekingStatus;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserSession;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.moderation.Admin;
import com.linker.backend.entity.moderation.AdminAction;
import com.linker.backend.entity.moderation.type.AdminActionType;
import com.linker.backend.entity.moderation.type.AdminRole;
import com.linker.backend.entity.moderation.Appeal;
import com.linker.backend.entity.moderation.type.AppealStatus;
import com.linker.backend.entity.moderation.Report;
import com.linker.backend.entity.moderation.ReportCase;
import com.linker.backend.entity.moderation.type.ReportCaseStatus;
import com.linker.backend.entity.moderation.ReportMessageSnapshot;
import com.linker.backend.entity.moderation.type.ReportReason;
import com.linker.backend.entity.moderation.type.ReportTargetType;
import com.linker.backend.entity.moderation.Sanction;
import com.linker.backend.entity.moderation.type.SanctionType;
import com.linker.backend.entity.notification.type.NotificationTypes;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.github.GithubTokenCipher;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.account.UserSessionRepository;
import com.linker.backend.repository.moderation.AdminActionRepository;
import com.linker.backend.repository.moderation.AdminRepository;
import com.linker.backend.repository.moderation.AppealRepository;
import com.linker.backend.repository.moderation.ReportCaseRepository;
import com.linker.backend.repository.moderation.ReportMessageSnapshotRepository;
import com.linker.backend.repository.moderation.ReportRepository;
import com.linker.backend.repository.moderation.SanctionRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Paired entry for {@link com.linker.backend.controller.admin.ModerationController}.
 * Hide, delete, and restore change the reported row when that table exists.
 */
@Service("adminModerationService")
public class ModerationService {

	private static final Set<AdminActionType> CONTENT_ACTIONS = EnumSet.of(
			AdminActionType.HIDE, AdminActionType.DELETE, AdminActionType.DISMISS, AdminActionType.RESTORE);
	private static final int REASON_MAX = 2000;

	private final ReportCaseRepository cases;
	private final ReportRepository reports;
	private final ReportMessageSnapshotRepository snapshots;
	private final SanctionRepository sanctions;
	private final AppealRepository appeals;
	private final AdminActionRepository actions;
	private final AdminRepository admins;
	private final UserRepository users;
	private final NotificationService notifications;
	private final GithubTokenCipher otpSecrets;
	private final UserSessionRepository sessions;
	private final ReportContentEffects content;
	private final java.time.Clock clock;

	public ModerationService(
			ReportCaseRepository cases,
			ReportRepository reports,
			ReportMessageSnapshotRepository snapshots,
			SanctionRepository sanctions,
			AppealRepository appeals,
			AdminActionRepository actions,
			AdminRepository admins,
			UserRepository users,
			NotificationService notifications,
			GithubTokenCipher otpSecrets,
			UserSessionRepository sessions,
			ReportContentEffects content,
			java.time.Clock clock) {
		this.cases = cases;
		this.reports = reports;
		this.snapshots = snapshots;
		this.sanctions = sanctions;
		this.appeals = appeals;
		this.actions = actions;
		this.admins = admins;
		this.users = users;
		this.notifications = notifications;
		this.otpSecrets = otpSecrets;
		this.sessions = sessions;
		this.content = content;
		this.clock = clock;
	}

	/**
	 * Opens this session for {@code /api/v1/admin/**}. The caller is a logged-in operator candidate;
	 * {@code ROLE_ADMIN} is granted only after this succeeds. Secret enrollment has no HTTP route yet.
	 */
	@Transactional
	public OtpVerifyResponse verifyOtp(AuthenticatedUser principal, OtpVerifyRequest request) {
		if (principal == null) {
			throw new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요");
		}
		Admin admin = admins.findByUser_Id(principal.userId())
				.orElseThrow(() -> new ApiException(403, "FORBIDDEN", "운영자만 쓸 수 있어요"));
		if (admin.getOtpSecretEnc() == null || admin.getOtpEnrolledAt() == null) {
			throw new ApiException(403, "OTP_NOT_ENROLLED", "운영자 OTP가 아직 등록되지 않았어요");
		}
		String code = request == null ? null : request.code();
		if (!TotpCodes.matches(decryptOtpSecret(admin), code, Instant.now(clock))) {
			throw new ApiException(400, "OTP_INVALID", "인증 코드가 맞지 않아요");
		}
		UserSession session = sessions.findById(principal.sessionId())
				.filter(row -> row.getRevokedAt() == null)
				.orElseThrow(() -> new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요"));
		session.markOtpVerified(Instant.now(clock));
		return new OtpVerifyResponse(true);
	}

	private String decryptOtpSecret(Admin admin) {
		try {
			return otpSecrets.decrypt(admin.getOtpSecretEnc());
		}
		catch (ApiException exception) {
			if (exception.getStatus() == 503) {
				throw new ApiException(503, "SERVICE_UNAVAILABLE", "운영자 OTP 확인이 아직 준비되지 않았어요");
			}
			throw exception;
		}
	}

	@Transactional(readOnly = true)
	public ReportCaseListResponse listCases(String status, String targetType, String overdue) {
		ReportTargetType type = targetType == null || targetType.isBlank() ? null : parseType(targetType);
		List<ReportCase> rows = type == null ? cases.findAll() : cases.findByTargetType(type);
		Set<Long> appealed = new HashSet<>(appeals.findPendingCaseIds());
		Instant now = Instant.now(clock);
		List<ReportCaseView> items = new ArrayList<>();
		for (ReportCase row : rows) {
			String view = viewStatus(row, appealed.contains(row.getId()));
			if (status != null && !status.isBlank() && !status.equals(view)) {
				continue;
			}
			boolean late = overdue(row, now);
			if ("true".equals(overdue) && !late) {
				continue;
			}
			items.add(viewOf(row, view, late, false));
		}
		items.sort(Comparator.comparing(ReportCaseView::receivedAt, Comparator.nullsLast(Comparator.reverseOrder())));
		return new ReportCaseListResponse(items);
	}

	@Transactional(readOnly = true)
	public ReportCaseView getCase(long caseId) {
		ReportCase row = cases.findById(caseId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "신고 건을 찾지 못했어요"));
		boolean appealed = appeals.findPendingCaseIds().contains(caseId);
		return viewOf(row, viewStatus(row, appealed), overdue(row, Instant.now(clock)), true);
	}

	@Transactional
	public ReportCaseView act(AuthenticatedUser principal, long caseId, ReportActionRequest request) {
		Admin admin = requireAdmin(principal);
		ReportCase row = cases.lockById(caseId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "신고 건을 찾지 못했어요"));
		if (request == null || request.action() == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		}
		AdminActionType action = parseAction(request.action());
		String reason = reasonFor(action, request.reason());
		Instant now = Instant.now(clock);
		switch (action) {
			case HIDE, DELETE, DISMISS -> {
				if (row.getStatus() != ReportCaseStatus.PENDING) {
					throw new ApiException(409, "CONFLICT", "이미 처리된 신고예요");
				}
				row.resolve(action == AdminActionType.DISMISS ? ReportCaseStatus.DISMISSED : ReportCaseStatus.ACTIONED, admin.getId(), now);
				if (action == AdminActionType.DISMISS) {
					cases.flush();
					restrictReporters(row, admin, now);
				}
			}
			case RESTORE -> {
				if (row.getStatus() == ReportCaseStatus.PENDING) {
					throw new ApiException(409, "CONFLICT", "대기 중인 신고는 복구할 수 없어요");
				}
				row.reopen();
			}
			default -> throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		}
		content.apply(row.getTargetType(), row.getTargetId(), action, now);
		if (action == AdminActionType.DISMISS && row.getAutoHiddenAt() != null) {
			content.undoAutoHide(row.getTargetType(), row.getTargetId());
		}
		actions.save(AdminAction.record(admin, action, row.getTargetType().name(), row.getTargetId(), row, reason));
		notifyOutcome(row, action, reason);
		boolean appealed = appeals.findPendingCaseIds().contains(caseId);
		return viewOf(row, viewStatus(row, appealed), overdue(row, now), true);
	}

	@Transactional(readOnly = true)
	public AppealListResponse listAppeals(String status) {
		List<Appeal> rows = appeals(status);
		List<AppealView> items = new ArrayList<>();
		for (Appeal appeal : rows) {
			items.add(appealView(appeal));
		}
		return new AppealListResponse(items);
	}

	@Transactional
	public void decideAppeal(AuthenticatedUser principal, long appealId, AppealDecisionRequest request) {
		Admin admin = requireAdmin(principal);
		if (request == null || request.accept() == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		}
		Appeal appeal = appeals.findById(appealId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "이의 제기를 찾지 못했어요"));
		if (appeal.getStatus() != AppealStatus.PENDING) {
			throw new ApiException(409, "CONFLICT", "이미 결정된 이의예요");
		}
		Sanction sanction = appeal.getSanction();
		Admin original = sanction.getAdmin();
		if (original != null && original.getId().equals(admin.getId())) {
			throw new ApiException(403, "SAME_HANDLER", "처음 처리한 운영자는 결정할 수 없어요");
		}
		if (sanction.getSanctionType() == SanctionType.PERMANENT_BAN && admin.getAdminRole() != AdminRole.LEAD) {
			throw new ApiException(403, "FORBIDDEN", "리드 운영자만 영구 정지 이의를 처리할 수 있어요");
		}
		Instant now = Instant.now(clock);
		String reason = blankToNull(request.reason());
		if (request.accept()) {
			appeal.accept(admin, now);
			sanction.revoke(now, admin.getId());
			ReportCase row = sanction.getReportCase();
			if (row != null && row.getStatus() != ReportCaseStatus.PENDING) {
				content.apply(row.getTargetType(), row.getTargetId(), AdminActionType.RESTORE, now);
				row.reopen();
				actions.save(AdminAction.record(admin, AdminActionType.RESTORE, row.getTargetType().name(), row.getTargetId(), row, reason));
			}
			actions.save(AdminAction.record(admin, AdminActionType.APPEAL_ACCEPT, "APPEAL", appeal.getId(), sanction.getReportCase(), reason));
			return;
		}
		appeal.reject(admin, now);
		actions.save(AdminAction.record(admin, AdminActionType.APPEAL_REJECT, "APPEAL", appeal.getId(), sanction.getReportCase(), reason));
	}

	private void restrictReporters(ReportCase row, Admin admin, Instant now) {
		Instant since = now.minus(PlanLimits.REPORT_DISMISS_WINDOW_DAYS, ChronoUnit.DAYS);
		Instant ends = now.plus(PlanLimits.REPORT_RESTRICTION_DAYS, ChronoUnit.DAYS);
		for (Long reporterId : reports.findReporterIdsByReportCaseId(row.getId())) {
			if (reports.countDismissedSince(reporterId, since) < PlanLimits.REPORT_DISMISS_LIMIT) {
				continue;
			}
			if (sanctions.hasActiveReportRestriction(reporterId, now)) {
				continue;
			}
			User reporter = users.findById(reporterId).orElse(null);
			if (reporter == null || reporter.getStatus() == UserStatus.DELETED || reporter.getDeletedAt() != null) {
				continue;
			}
			sanctions.save(Sanction.reportRestriction(reporter, row, admin, now, ends));
			actions.save(AdminAction.record(admin, AdminActionType.SANCTION, "USER", reporterId, row, "FALSE_REPORT"));
		}
	}

	private void notifyOutcome(ReportCase row, AdminActionType action, String reason) {
		String authorMessage = switch (action) {
			case HIDE -> "작성한 내용이 숨김 처리됐어요";
			case DELETE -> "작성한 내용이 삭제됐어요";
			case DISMISS -> "신고가 기각됐어요";
			case RESTORE -> "처리된 내용이 복구됐어요";
			default -> null;
		};
		String reporterMessage = switch (action) {
			case HIDE -> "신고한 내용이 숨김 처리됐어요";
			case DELETE -> "신고한 내용이 삭제됐어요";
			case DISMISS -> "신고가 기각됐어요";
			case RESTORE -> "신고한 내용이 복구됐어요";
			default -> null;
		};
		if (authorMessage == null) {
			return;
		}
		notify(row.getTargetUserId(), authorMessage, reason, "author:" + row.getId());
		for (Long reporterId : reports.findReporterIdsByReportCaseId(row.getId())) {
			notify(reporterId, reporterMessage, null, "reporter:" + row.getId() + ":" + reporterId);
		}
	}

	private void notify(long userId, String message, String reason, String groupKey) {
		User user = users.findById(userId).orElse(null);
		if (user == null || user.getStatus() == UserStatus.DELETED || user.getDeletedAt() != null) {
			return;
		}
		notifications.create(new CreateNotificationCommand(
				userId,
				NotificationTypes.REPORT_OUTCOME,
				null,
				null,
				null,
				null,
				payload(message, reason),
				"report-outcome:" + groupKey));
	}

	private ReportCaseView viewOf(ReportCase row, String status, boolean late, boolean withChat) {
		List<Report> filed = reports.findByReportCase_Id(row.getId());
		User target = users.findById(row.getTargetUserId()).orElse(null);
		List<ChatLine> chat = withChat ? chat(row) : null;
		return new ReportCaseView(
				row.getId(),
				status,
				apiType(row.getTargetType()),
				summary(row, filed, chat),
				reasonCounts(filed),
				row.getReporterCount(),
				row.getAutoHiddenAt() != null,
				row.getCreatedAt(),
				late,
				person(target),
				chat,
				handledAction(row.getId()));
	}

	private List<ChatLine> chat(ReportCase row) {
		if (row.getTargetType() != ReportTargetType.TEAM_MESSAGE && row.getTargetType() != ReportTargetType.DM_MESSAGE) {
			return null;
		}
		Map<Long, ChatLine> lines = new LinkedHashMap<>();
		for (ReportMessageSnapshot snapshot : snapshots.findByReport_ReportCase_IdOrderByRelPositionAsc(row.getId())) {
			lines.putIfAbsent(snapshot.getMessageId(), new ChatLine(
					senderName(snapshot.getSenderId()),
					snapshot.getBody(),
					snapshot.getRelPosition() == 0));
		}
		return lines.isEmpty() ? null : List.copyOf(lines.values());
	}

	private String summary(ReportCase row, List<Report> filed, List<ChatLine> chat) {
		if (chat != null) {
			for (ChatLine line : chat) {
				if (line.reported()) {
					return line.text();
				}
			}
		}
		if (row.getTargetType() == ReportTargetType.USER) {
			return "사용자 프로필";
		}
		for (Report report : filed) {
			if (report.getDetail() != null && !report.getDetail().isBlank()) {
				return report.getDetail();
			}
		}
		return "대상 본문은 글, 댓글, 모집 글이 연결된 뒤에 보여요";
	}

	private List<ReasonCount> reasonCounts(List<Report> filed) {
		Map<ReportReason, Integer> counts = new LinkedHashMap<>();
		for (Report report : filed) {
			counts.merge(report.getReason(), 1, Integer::sum);
		}
		return counts.entrySet().stream()
				.sorted(Map.Entry.<ReportReason, Integer>comparingByValue().reversed())
				.map(entry -> new ReasonCount(entry.getKey().name(), entry.getValue()))
				.toList();
	}

	private String handledAction(long caseId) {
		return actions.findFirstByReportCase_IdAndActionInOrderByIdDesc(caseId, CONTENT_ACTIONS)
				.map(action -> action.getAction().name())
				.orElse(null);
	}

	private String senderName(long userId) {
		User user = users.findById(userId).orElse(null);
		return user == null ? "사용자" : user.visibleName();
	}

	private Person person(User user) {
		if (user == null) {
			return new Person(0, "", "사용자", null, "DEVELOPER", "OFF");
		}
		return new Person(
				user.getId(),
				user.getUsername(),
				user.visibleName(),
				user.getAvatarUrl(),
				user.getUserType().name(),
				jobStatus(user.getJobSeekingStatus()));
	}

	private AppealView appealView(Appeal appeal) {
		Sanction sanction = appeal.getSanction();
		ReportCase row = sanction.getReportCase();
		String handler = sanction.getAdmin() == null || sanction.getAdmin().getUser() == null
				? ""
				: sanction.getAdmin().getUser().visibleName();
		String status = appeal.getStatus() == AppealStatus.PENDING ? "PENDING" : "DECIDED";
		return new AppealView(
				appeal.getId(),
				status,
				person(appeal.getUser()),
				row == null || row.getId() == null ? 0 : row.getId(),
				appeal.getBody(),
				appeal.getCreatedAt(),
				handler);
	}

	private List<Appeal> appeals(String status) {
		if (status == null || status.isBlank()) {
			List<Appeal> rows = new ArrayList<>(appeals.findByStatusOrderByIdDesc(AppealStatus.PENDING));
			rows.addAll(appeals.findByStatusOrderByIdDesc(AppealStatus.ACCEPTED));
			rows.addAll(appeals.findByStatusOrderByIdDesc(AppealStatus.REJECTED));
			return rows;
		}
		if ("PENDING".equals(status)) {
			return appeals.findByStatusOrderByIdDesc(AppealStatus.PENDING);
		}
		if ("DECIDED".equals(status)) {
			List<Appeal> rows = new ArrayList<>(appeals.findByStatusOrderByIdDesc(AppealStatus.ACCEPTED));
			rows.addAll(appeals.findByStatusOrderByIdDesc(AppealStatus.REJECTED));
			return rows;
		}
		throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
	}

	private Admin requireAdmin(AuthenticatedUser principal) {
		return admins.findByUser_Id(principal.userId())
				.orElseThrow(() -> new ApiException(403, "FORBIDDEN", "운영자만 쓸 수 있어요"));
	}

	private static AdminActionType parseAction(String raw) {
		try {
			AdminActionType action = AdminActionType.valueOf(raw);
			if (!CONTENT_ACTIONS.contains(action)) {
				throw new IllegalArgumentException();
			}
			return action;
		}
		catch (IllegalArgumentException exception) {
			throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		}
	}

	private static String reasonFor(AdminActionType action, String raw) {
		String reason = blankToNull(raw);
		if ((action == AdminActionType.HIDE || action == AdminActionType.DELETE) && reason == null) {
			throw new ApiException(400, "REASON_REQUIRED", "사유를 입력해 주세요");
		}
		if (reason != null && reason.length() > REASON_MAX) {
			throw new ApiException(400, "VALIDATION_ERROR", "사유를 확인해 주세요");
		}
		return reason;
	}

	private static ReportTargetType parseType(String raw) {
		String value = "DIRECT_MESSAGE".equals(raw) ? "DM_MESSAGE" : raw;
		try {
			return ReportTargetType.valueOf(value);
		}
		catch (IllegalArgumentException exception) {
			throw new ApiException(400, "VALIDATION_ERROR", "신고 대상을 확인해 주세요");
		}
	}

	private static String apiType(ReportTargetType type) {
		return type == ReportTargetType.DM_MESSAGE ? "DIRECT_MESSAGE" : type.name();
	}

	private static String viewStatus(ReportCase row, boolean appealed) {
		if (appealed) {
			return "APPEALED";
		}
		return row.getStatus() == ReportCaseStatus.PENDING ? "PENDING" : "HANDLED";
	}

	private static boolean overdue(ReportCase row, Instant now) {
		if (row.getStatus() != ReportCaseStatus.PENDING || row.getCreatedAt() == null) {
			return false;
		}
		Instant deadline = BusinessDays.plus(row.getCreatedAt(), PlanLimits.REPORT_HANDLING_BUSINESS_DAYS, PlanLimits.APP_ZONE);
		return !now.isBefore(deadline);
	}

	private static String jobStatus(JobSeekingStatus status) {
		if (status == null) {
			return "OFF";
		}
		return switch (status) {
			case OPEN -> "SEEKING";
			case OFFERS_ONLY -> "OPEN";
			case OFF -> "OFF";
		};
	}

	private static String blankToNull(String raw) {
		if (raw == null) {
			return null;
		}
		String trimmed = raw.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}

	private static String payload(String message, String reason) {
		StringBuilder json = new StringBuilder("{\"message\":\"").append(escape(message)).append('"');
		if (reason != null) {
			json.append(",\"reason\":\"").append(escape(reason)).append('"');
		}
		return json.append('}').toString();
	}

	private static String escape(String value) {
		return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
	}
}
