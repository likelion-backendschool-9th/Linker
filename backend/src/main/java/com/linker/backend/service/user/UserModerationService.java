package com.linker.backend.service.user;

import java.time.Clock;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import com.linker.backend.dto.moderation.response.BlockView;
import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.moderation.Report;
import com.linker.backend.entity.moderation.ReportCase;
import com.linker.backend.entity.moderation.ReportReason;
import com.linker.backend.entity.moderation.ReportTargetType;
import com.linker.backend.entity.moderation.UserBlock;
import com.linker.backend.entity.notification.NotificationTypes;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.time.DatabaseInstant;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.moderation.AdminRepository;
import com.linker.backend.repository.moderation.BlockInserter;
import com.linker.backend.repository.moderation.ReportCaseOpener;
import com.linker.backend.repository.moderation.ReportCaseRepository;
import com.linker.backend.repository.moderation.ReportRepository;
import com.linker.backend.repository.moderation.SanctionRepository;
import com.linker.backend.repository.moderation.UserBlockRepository;
import com.linker.backend.service.admin.AdminNotificationService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Paired entry for {@link com.linker.backend.controller.user.UserModerationController}.
 * D2 block-period helpers ({@link #hidesDirectMessage}, {@link #blockedEitherWay}) stay here for chat.
 * Report auto-hide may call {@link AdminNotificationService#create} (narrow AGENTS exception).
 */
@Service
public class UserModerationService {

	private final UserRepository users;
	private final UserBlockRepository blocks;
	private final BlockInserter inserter;
	private final ReportCaseRepository cases;
	private final ReportCaseOpener caseOpener;
	private final ReportRepository reports;
	private final AdminRepository admins;
	private final AdminNotificationService adminNotifications;
	private final SanctionRepository sanctions;
	private final Clock clock;

	public UserModerationService(
			UserRepository users,
			UserBlockRepository blocks,
			BlockInserter inserter,
			ReportCaseRepository cases,
			ReportCaseOpener caseOpener,
			ReportRepository reports,
			AdminRepository admins,
			AdminNotificationService adminNotifications,
			SanctionRepository sanctions,
			Clock clock
	) {
		this.users = users;
		this.blocks = blocks;
		this.inserter = inserter;
		this.cases = cases;
		this.caseOpener = caseOpener;
		this.reports = reports;
		this.admins = admins;
		this.adminNotifications = adminNotifications;
		this.sanctions = sanctions;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public List<BlockView> listBlocks(long blockerId) {
		return blocks.findActive(blockerId).stream()
				.flatMap(block -> users.findById(block.getBlockedId())
						.filter(user -> user.getStatus() != UserStatus.DELETED && user.getDeletedAt() == null)
						.map(blocked -> new BlockView(
								new BlockView.UserCard(blocked.getId(), blocked.getUsername(), blocked.visibleName()),
								block.getCreatedAt()
						))
						.stream())
				.toList();
	}

	@Transactional
	public void block(long blockerId, long blockedId) {
		if (blockerId == blockedId) {
			throw new ApiException(400, "VALIDATION_ERROR", "자기 자신은 차단할 수 없어요");
		}
		User blocked = users.findById(blockedId)
				.filter(user -> user.getStatus() != UserStatus.DELETED && user.getDeletedAt() == null)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));
		if (blocked.getId() == null) {
			throw new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요");
		}
		if (blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(blockerId, blockedId)) {
			return;
		}
		inserter.insertActive(blockerId, blockedId, DatabaseInstant.now(clock));
	}

	@Transactional
	public void unblock(long blockerId, long blockedId) {
		UserBlock active = blocks.findByBlockerIdAndBlockedIdAndUnblockedAtIsNull(blockerId, blockedId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "차단 중인 사용자가 아니에요"));
		active.close(DatabaseInstant.now(clock));
	}

	@Transactional(readOnly = true)
	public boolean blockedEitherWay(long firstUserId, long secondUserId) {
		return blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(firstUserId, secondUserId)
				|| blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(secondUserId, firstUserId);
	}

	/**
	 * Whether a 1:1 message from {@code senderId} at {@code messageCreatedAt} must stay invisible
	 * to {@code viewerId}. Uses every period the viewer owns (active and closed).
	 */
	@Transactional(readOnly = true)
	public boolean hidesDirectMessage(long viewerId, long senderId, Instant messageCreatedAt) {
		if (viewerId == senderId || messageCreatedAt == null) {
			return false;
		}
		return blocks.existsCovering(viewerId, senderId, messageCreatedAt);
	}

	@Transactional
	public void report(long reporterId, String targetType, Object targetId, String reason, String detail) {
		ReportTargetType type = parseType(targetType);
		ReportReason reportReason = parseReason(reason);
		String normalizedDetail = normalizeDetail(reportReason, detail);
		if (sanctions.hasActiveReportRestriction(reporterId, Instant.now(clock))) {
			throw new ApiException(403, "REPORT_RESTRICTED", "최근 30일 동안 기각이 5번이라 30일 동안 신고할 수 없어요");
		}
		long parsedTargetId = parseTargetId(targetId);
		long targetUserId = resolveTargetUserId(type, parsedTargetId);
		if (targetUserId == reporterId) {
			throw new ApiException(400, "VALIDATION_ERROR", "본인은 신고할 수 없어요");
		}
		long caseId = caseOpener.openPending(type, parsedTargetId, targetUserId);
		ReportCase reportCase = cases.lockById(caseId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "신고할 대상을 찾을 수 없어요"));
		if (reports.existsByReportCase_IdAndReporterId(reportCase.getId(), reporterId)) {
			return;
		}
		reports.saveAndFlush(Report.create(reportCase, reporterId, reportReason, normalizedDetail));
		int count = (int) reports.countEligibleReporters(reportCase.getId(), Instant.now(clock));
		reportCase.changeReporterCount(count);
		if (count >= PlanLimits.REPORT_AUTO_HIDE_REPORTERS && reportCase.getAutoHiddenAt() == null) {
			reportCase.markAutoHidden(Instant.now());
			notifyOperatorsOfAutoHide(reportCase);
			// Target content visibility (UNDER_REVIEW) lands with posts/chat pages that own the rows.
		}
		// Chat ±PlanLimits.REPORT_CHAT_CONTEXT_MESSAGES snapshots need chat_messages +
		// report_message_snapshots (ERD page 17). Reporter outcome / sanction alerts are page 25.
	}

	/**
	 * First auto-hide only (caller already guarded {@code autoHiddenAt}). Same transaction as
	 * {@link #report}; creates one {@code REPORT_AUTO_HIDDEN} row per active operator, skipping the
	 * reported user and reporters. {@code groupKey} is not an idempotency key.
	 */
	private void notifyOperatorsOfAutoHide(ReportCase reportCase) {
		long caseId = reportCase.getId();
		Set<Long> excluded = new HashSet<>(reports.findReporterIdsByReportCaseId(caseId));
		excluded.add(reportCase.getTargetUserId());
		String groupKey = "report-auto-hidden:" + caseId;
		for (Long operatorUserId : admins.findActiveOperatorUserIds()) {
			if (excluded.contains(operatorUserId)) {
				continue;
			}
			adminNotifications.create(new CreateNotificationCommand(
					operatorUserId,
					NotificationTypes.REPORT_AUTO_HIDDEN,
					null,
					null,
					null,
					"/admin/reports",
					null,
					groupKey
			));
		}
	}

	private long resolveTargetUserId(ReportTargetType type, long targetId) {
		// Non-USER targets resolve once their owning tables exist (posts, chat, ads).
		if (type != ReportTargetType.USER) {
			throw new ApiException(404, "NOT_FOUND", "신고할 대상을 찾을 수 없어요");
		}
		return users.findById(targetId)
				.filter(user -> user.getStatus() != UserStatus.DELETED && user.getDeletedAt() == null)
				.map(User::getId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "신고할 대상을 찾을 수 없어요"));
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
