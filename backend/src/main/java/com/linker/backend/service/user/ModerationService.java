package com.linker.backend.service.user;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import com.linker.backend.dto.moderation.response.BlockView;
import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.chat.ChatMessage;
import com.linker.backend.entity.chat.type.MessageVisibility;
import com.linker.backend.entity.chat.type.RoomType;
import com.linker.backend.entity.moderation.Appeal;
import com.linker.backend.entity.moderation.Report;
import com.linker.backend.entity.moderation.ReportMessageSnapshot;
import com.linker.backend.entity.moderation.Sanction;
import com.linker.backend.entity.moderation.ReportCase;
import com.linker.backend.entity.moderation.type.ReportReason;
import com.linker.backend.entity.moderation.type.ReportTargetType;
import com.linker.backend.entity.moderation.UserBlock;
import com.linker.backend.entity.notification.type.NotificationTypes;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.time.DatabaseInstant;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.chat.ChatMessageRepository;
import com.linker.backend.repository.chat.ChatMessageRepositoryCustom.ChatMessageRow;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.profile.FollowRepository;
import com.linker.backend.repository.moderation.AdminRepository;
import com.linker.backend.repository.moderation.AppealRepository;
import com.linker.backend.repository.moderation.BlockInserter;
import com.linker.backend.repository.moderation.ReportCaseOpener;
import com.linker.backend.repository.moderation.ReportCaseRepository;
import com.linker.backend.repository.moderation.ReportMessageSnapshotRepository;
import com.linker.backend.repository.moderation.ReportRepository;
import com.linker.backend.repository.moderation.SanctionRepository;
import com.linker.backend.repository.moderation.UserBlockRepository;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Paired entry for {@link com.linker.backend.controller.user.ModerationController}.
 * D2 block-period helpers ({@link #hidesDirectMessage}, {@link #blockedEitherWay}) stay here for chat.
 * Report auto-hide may call {@link com.linker.backend.service.admin.NotificationService#create} (narrow AGENTS exception).
 */
@Service("userModerationService")
public class ModerationService {

	private final UserRepository users;
	private final UserBlockRepository blocks;
	private final BlockInserter inserter;
	private final ReportCaseRepository cases;
	private final ReportCaseOpener caseOpener;
	private final ReportRepository reports;
	private final AdminRepository admins;
	private final com.linker.backend.service.admin.NotificationService adminNotifications;
	private final SanctionRepository sanctions;
	private final AppealRepository appeals;
	private final FollowRepository follows;
	private final ChatMessageRepository messages;
	private final ChatRoomMemberRepository roomMembers;
	private final ReportMessageSnapshotRepository snapshots;
	private final Clock clock;

	public ModerationService(
			UserRepository users,
			UserBlockRepository blocks,
			BlockInserter inserter,
			ReportCaseRepository cases,
			ReportCaseOpener caseOpener,
			ReportRepository reports,
			AdminRepository admins,
			com.linker.backend.service.admin.NotificationService adminNotifications,
			SanctionRepository sanctions,
			AppealRepository appeals,
			FollowRepository follows,
			ChatMessageRepository messages,
			ChatRoomMemberRepository roomMembers,
			ReportMessageSnapshotRepository snapshots,
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
		this.appeals = appeals;
		this.follows = follows;
		this.messages = messages;
		this.roomMembers = roomMembers;
		this.snapshots = snapshots;
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
		follows.deleteBetween(blockerId, blockedId);
		if (blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(blockerId, blockedId)) {
			return;
		}
		inserter.insertActive(blockerId, blockedId, DatabaseInstant.now(clock));
	}

	/**
	 * One appeal per sanction for the sanctioned user. Does not accept or reject it.
	 */
	@Transactional
	public long appeal(long userId, Long sanctionId, String body) {
		if (sanctionId == null || body == null || body.isBlank()) {
			throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		}
		Sanction sanction = sanctions.findById(sanctionId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "대상을 찾을 수 없어요"));
		if (!sanction.getUser().getId().equals(userId)) {
			throw new ApiException(404, "NOT_FOUND", "대상을 찾을 수 없어요");
		}
		if (sanction.getRevokedAt() != null) {
			throw new ApiException(409, "STATE_CONFLICT", "취소된 제재는 이의 제기할 수 없어요");
		}
		if (appeals.existsBySanction_Id(sanction.getId())) {
			throw new ApiException(409, "ALREADY_APPEALED", "이미 이의 제기를 접수했어요.");
		}
		User account = users.findById(userId)
				.filter(user -> user.getStatus() != UserStatus.DELETED && user.getDeletedAt() == null)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));
		try {
			return appeals.saveAndFlush(Appeal.open(account, sanction, body.trim())).getId();
		}
		catch (DataIntegrityViolationException exception) {
			throw new ApiException(409, "ALREADY_APPEALED", "이미 이의 제기를 접수했어요.");
		}
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
		ChatMessage reportedMessage = isChatTarget(type) ? resolveReportableMessage(type, parsedTargetId, reporterId) : null;
		long targetUserId = reportedMessage != null
				? reportedMessage.getSenderId()
				: resolveTargetUserId(type, parsedTargetId);
		if (targetUserId == reporterId) {
			throw new ApiException(400, "VALIDATION_ERROR", "본인은 신고할 수 없어요");
		}
		long caseId = caseOpener.openPending(type, parsedTargetId, targetUserId);
		ReportCase reportCase = cases.lockById(caseId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "신고할 대상을 찾을 수 없어요"));
		if (reports.existsByReportCase_IdAndReporterId(reportCase.getId(), reporterId)) {
			return;
		}
		Report report = reports.saveAndFlush(Report.create(reportCase, reporterId, reportReason, normalizedDetail));
		// The case row is locked, so only its first report sees no snapshot and copies the context.
		if (reportedMessage != null && !snapshots.existsByReport_ReportCase_Id(reportCase.getId())) {
			copyChatContext(report, reportedMessage, reporterId);
		}
		int count = (int) reports.countEligibleReporters(reportCase.getId(), Instant.now(clock));
		reportCase.changeReporterCount(count);
		if (count >= PlanLimits.REPORT_AUTO_HIDE_REPORTERS && reportCase.getAutoHiddenAt() == null) {
			reportCase.markAutoHidden(Instant.now());
			notifyOperatorsOfAutoHide(reportCase);
			// Target content visibility (UNDER_REVIEW) lands with posts/chat pages that own the rows.
		}
		// Reporter outcome / sanction alerts are page 25.
	}

	private static boolean isChatTarget(ReportTargetType type) {
		return type == ReportTargetType.TEAM_MESSAGE || type == ReportTargetType.DM_MESSAGE;
	}

	/**
	 * The message must sit in a room of the reported kind, still be readable, and be one the reporter
	 * can see right now (active member, history window, own block periods). Anything else is 404 so a
	 * report does not reveal rows outside the reporter's view.
	 */
	private ChatMessage resolveReportableMessage(ReportTargetType type, long messageId, long reporterId) {
		ChatMessage message = messages.findWithRoom(messageId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "신고할 대상을 찾을 수 없어요"));
		boolean team = message.getRoom().getRoomType() == RoomType.TEAM;
		long roomId = message.getRoom().getId();
		if (team != (type == ReportTargetType.TEAM_MESSAGE)
				|| !readable(message.getSenderId(), message.getDeletedAt(), message.getVisibility().name())
				|| roomMembers.findActive(roomId, reporterId).isEmpty()
				|| !messages.visibleTo(reporterId, roomId, team, historyStart(team), messageId)) {
			throw new ApiException(404, "NOT_FOUND", "신고할 대상을 찾을 수 없어요");
		}
		return message;
	}

	/**
	 * Copies the reported message (0) and up to {@link PlanLimits#REPORT_CHAT_CONTEXT_MESSAGES} lines on
	 * each side (-n..-1, 1..n), taken from what the reporter could read at report time. Deleted, hidden
	 * and sender-less (system) rows are skipped, and the next readable row fills the slot.
	 */
	private void copyChatContext(Report report, ChatMessage target, long reporterId) {
		long roomId = target.getRoom().getId();
		boolean team = target.getRoom().getRoomType() == RoomType.TEAM;
		Instant start = historyStart(team);
		List<ChatMessageRow> before = readableNeighbours(reporterId, roomId, team, start, target.getId(), true);
		List<ChatMessageRow> after = readableNeighbours(reporterId, roomId, team, start, target.getId(), false);
		List<ReportMessageSnapshot> lines = new ArrayList<>(before.size() + 1 + after.size());
		for (int i = 0; i < before.size(); i++) {
			lines.add(snapshot(report, before.get(i), i - before.size()));
		}
		lines.add(ReportMessageSnapshot.copy(
				report, target.getId(), target.getSenderId(), target.getBody(), 0, target.getCreatedAt()));
		for (int i = 0; i < after.size(); i++) {
			lines.add(snapshot(report, after.get(i), i + 1));
		}
		snapshots.saveAll(lines);
	}

	/** Nearest readable rows on one side of {@code anchorId}, in ascending id order. */
	private List<ChatMessageRow> readableNeighbours(
			long viewerId, long roomId, boolean team, Instant start, long anchorId, boolean older) {
		int wanted = PlanLimits.REPORT_CHAT_CONTEXT_MESSAGES;
		int batch = wanted * 3;
		List<ChatMessageRow> kept = new ArrayList<>(wanted);
		long cursor = anchorId;
		while (kept.size() < wanted) {
			List<ChatMessageRow> page = older
					? messages.before(viewerId, roomId, team, start, cursor, batch)
					: messages.after(viewerId, roomId, team, start, cursor, batch);
			if (page.isEmpty()) {
				break;
			}
			// before() and after() both return ascending ids; walk away from the anchor.
			List<ChatMessageRow> outward = new ArrayList<>(page);
			if (older) {
				Collections.reverse(outward);
			}
			for (ChatMessageRow row : outward) {
				if (kept.size() == wanted) {
					break;
				}
				if (readable(row.senderId(), row.deletedAt(), row.visibility())) {
					kept.add(row);
				}
			}
			if (page.size() < batch) {
				break;
			}
			cursor = outward.get(outward.size() - 1).id();
		}
		if (older) {
			Collections.reverse(kept);
		}
		return kept;
	}

	private static boolean readable(Long senderId, Instant deletedAt, String visibility) {
		return senderId != null && deletedAt == null && MessageVisibility.VISIBLE.name().equals(visibility);
	}

	private static ReportMessageSnapshot snapshot(Report report, ChatMessageRow row, int relPosition) {
		return ReportMessageSnapshot.copy(report, row.id(), row.senderId(), row.body(), relPosition, row.createdAt());
	}

	/** Same window as {@code user.ChatService.historyStart}: free team history only; 1:1 has none. */
	private Instant historyStart(boolean team) {
		if (!team) {
			return null;
		}
		return clock.instant().minus(Duration.ofDays(PlanLimits.TEAM_CHAT_HISTORY_DAYS_FREE));
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
		// Chat messages resolve in resolveReportableMessage. Posts, comments, recruit posts and ads
		// resolve once their report paths are wired.
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
