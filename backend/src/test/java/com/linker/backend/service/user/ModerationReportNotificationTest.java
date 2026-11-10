package com.linker.backend.service.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.moderation.ReportCase;
import com.linker.backend.entity.moderation.type.ReportTargetType;
import com.linker.backend.entity.notification.type.NotificationTypes;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.moderation.AdminRepository;
import com.linker.backend.repository.moderation.BlockInserter;
import com.linker.backend.repository.moderation.ReportCaseOpener;
import com.linker.backend.repository.moderation.ReportCaseRepository;
import com.linker.backend.repository.moderation.ReportRepository;
import com.linker.backend.repository.moderation.UserBlockRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ModerationReportNotificationTest {

	@Mock
	UserRepository users;
	@Mock
	UserBlockRepository blocks;
	@Mock
	BlockInserter inserter;
	@Mock
	ReportCaseRepository cases;
	@Mock
	ReportCaseOpener caseOpener;
	@Mock
	ReportRepository reports;
	@Mock
	AdminRepository admins;
	@Mock
	com.linker.backend.service.admin.NotificationService adminNotifications;
	@Mock
	com.linker.backend.repository.moderation.SanctionRepository sanctions;

	@Mock
	com.linker.backend.repository.profile.FollowRepository follows;
	@Mock
	com.linker.backend.repository.post.PostRepository posts;
	@Mock
	com.linker.backend.repository.post.CommentRepository comments;

	ModerationService service;

	@BeforeEach
	void setUp() {
		service = new ModerationService(
				users, blocks, inserter, cases, caseOpener, reports, admins, adminNotifications, sanctions, null, follows,
				null, null, null, null, posts, comments, null, Clock.systemUTC());
	}

	@Test
	void restrictedReporterCannotFileAnotherReport() {
		when(sanctions.hasActiveReportRestriction(eq(5L), any())).thenReturn(true);

		assertThatThrownBy(() -> service.report(5L, "USER", 900L, "SPAM", null))
				.isInstanceOf(com.linker.backend.global.error.ApiException.class)
				.hasMessage("최근 30일 동안 기각이 5번이라 30일 동안 신고할 수 없어요");
	}

	@Test
	void firstAutoHideNotifiesEachActiveOperatorOnce() {
		long caseId = 50L;
		long targetUserId = 900L;
		ReportCase reportCase = lockedCase(caseId, targetUserId, null);
		stubNewReport(caseId, reportCase, 5L, PlanLimits.REPORT_AUTO_HIDE_REPORTERS);
		when(reports.findReporterIdsByReportCaseId(caseId)).thenReturn(List.of(1L, 2L, 3L, 4L, 5L));
		when(admins.findActiveOperatorUserIds()).thenReturn(List.of(101L, 102L));

		service.report(5L, "USER", targetUserId, "SPAM", null);

		assertThat(reportCase.getAutoHiddenAt()).isNotNull();
		ArgumentCaptor<CreateNotificationCommand> captor = ArgumentCaptor.forClass(CreateNotificationCommand.class);
		verify(adminNotifications, times(2)).create(captor.capture());
		assertThat(captor.getAllValues()).extracting(CreateNotificationCommand::recipientUserId)
				.containsExactly(101L, 102L);
		assertThat(captor.getAllValues()).allSatisfy(command -> {
			assertThat(command.notificationType()).isEqualTo(NotificationTypes.REPORT_AUTO_HIDDEN);
			assertThat(command.actorUserId()).isNull();
			assertThat(command.targetType()).isNull();
			assertThat(command.targetId()).isNull();
			assertThat(command.linkPath()).isEqualTo("/admin/reports");
			assertThat(command.payloadJson()).isNull();
			assertThat(command.groupKey()).isEqualTo("report-auto-hidden:" + caseId);
		});
	}

	@Test
	void additionalReportAfterAutoHideDoesNotCreateAgain() {
		long caseId = 51L;
		ReportCase reportCase = lockedCase(caseId, 900L, Instant.parse("2026-11-05T00:00:00Z"));
		stubNewReport(caseId, reportCase, 6L, PlanLimits.REPORT_AUTO_HIDE_REPORTERS + 1);

		service.report(6L, "USER", 900L, "SPAM", null);

		verifyNoInteractions(admins);
		verify(adminNotifications, never()).create(any());
		assertThat(reportCase.getAutoHiddenAt()).isEqualTo(Instant.parse("2026-11-05T00:00:00Z"));
	}

	@Test
	void belowThresholdDoesNotNotify() {
		long caseId = 52L;
		ReportCase reportCase = lockedCase(caseId, 900L, null);
		stubNewReport(caseId, reportCase, 1L, PlanLimits.REPORT_AUTO_HIDE_REPORTERS - 1);

		service.report(1L, "USER", 900L, "SPAM", null);

		assertThat(reportCase.getAutoHiddenAt()).isNull();
		verifyNoInteractions(admins);
		verify(adminNotifications, never()).create(any());
	}

	@Test
	void skipsReportedUserAndReportersEvenIfTheyAreOperators() {
		long caseId = 53L;
		long targetUserId = 900L;
		ReportCase reportCase = lockedCase(caseId, targetUserId, null);
		stubNewReport(caseId, reportCase, 5L, PlanLimits.REPORT_AUTO_HIDE_REPORTERS);
		when(reports.findReporterIdsByReportCaseId(caseId)).thenReturn(List.of(1L, 2L, 3L, 4L, 5L));
		when(admins.findActiveOperatorUserIds()).thenReturn(List.of(targetUserId, 5L, 200L));

		service.report(5L, "USER", targetUserId, "SPAM", null);

		ArgumentCaptor<CreateNotificationCommand> captor = ArgumentCaptor.forClass(CreateNotificationCommand.class);
		verify(adminNotifications, times(1)).create(captor.capture());
		assertThat(captor.getValue().recipientUserId()).isEqualTo(200L);
	}

	@Test
	void createFailureRollsBackWithTheCallerBecauseItJoinsTheTransaction() {
		long caseId = 54L;
		ReportCase reportCase = lockedCase(caseId, 900L, null);
		stubNewReport(caseId, reportCase, 5L, PlanLimits.REPORT_AUTO_HIDE_REPORTERS);
		when(reports.findReporterIdsByReportCaseId(caseId)).thenReturn(List.of(1L, 2L, 3L, 4L, 5L));
		when(admins.findActiveOperatorUserIds()).thenReturn(List.of(101L));
		when(adminNotifications.create(any())).thenThrow(new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));

		assertThatThrownBy(() -> service.report(5L, "USER", 900L, "SPAM", null))
				.isInstanceOf(ApiException.class)
				.satisfies(error -> assertThat(((ApiException) error).getCode()).isEqualTo("NOT_FOUND"));
		// In-memory mark happens before create throws; the surrounding @Transactional rolls the DB back.
		assertThat(reportCase.getAutoHiddenAt()).isNotNull();
	}

	@Test
	void concurrentSecondTransitionIsSkippedByAutoHiddenGuard() {
		long caseId = 55L;
		long targetUserId = 900L;
		ReportCase reportCase = lockedCase(caseId, targetUserId, null);
		AtomicInteger countCalls = new AtomicInteger();
		User target = User.create("target", UserType.DEVELOPER);
		ReflectionTestUtils.setField(target, "id", targetUserId);
		when(users.findById(targetUserId)).thenReturn(Optional.of(target));
		when(caseOpener.openPending(ReportTargetType.USER, targetUserId, targetUserId)).thenReturn(caseId);
		when(cases.lockById(caseId)).thenReturn(Optional.of(reportCase));
		when(reports.existsByReportCase_IdAndReporterId(eq(caseId), any(Long.class))).thenReturn(false);
		when(reports.countEligibleReporters(eq(caseId), any())).thenAnswer(invocation -> {
			int n = countCalls.incrementAndGet();
			return (long) (PlanLimits.REPORT_AUTO_HIDE_REPORTERS + n - 1);
		});
		when(reports.findReporterIdsByReportCaseId(caseId)).thenReturn(List.of(1L, 2L, 3L, 4L, 5L));
		when(admins.findActiveOperatorUserIds()).thenReturn(List.of(101L));

		service.report(5L, "USER", targetUserId, "SPAM", null);
		service.report(6L, "USER", targetUserId, "SPAM", null);

		verify(adminNotifications, times(1)).create(any());
	}

	@Test
	void fifthReporterOfAPostSendsItToReviewAndOperatorsAreTold() {
		long caseId = 60L;
		long authorId = 900L;
		com.linker.backend.entity.post.Post post = visiblePost(77L, authorId);
		when(posts.findDetailedById(77L)).thenReturn(Optional.of(post));
		ReportCase reportCase = ReportCase.open(ReportTargetType.POST, 77L, authorId);
		ReflectionTestUtils.setField(reportCase, "id", caseId);
		when(caseOpener.openPending(ReportTargetType.POST, 77L, authorId)).thenReturn(caseId);
		when(cases.lockById(caseId)).thenReturn(Optional.of(reportCase));
		when(reports.existsByReportCase_IdAndReporterId(caseId, 5L)).thenReturn(false);
		when(reports.countEligibleReporters(eq(caseId), any())).thenReturn((long) PlanLimits.REPORT_AUTO_HIDE_REPORTERS);
		when(reports.findReporterIdsByReportCaseId(caseId)).thenReturn(List.of(1L, 2L, 3L, 4L, 5L));
		when(admins.findActiveOperatorUserIds()).thenReturn(List.of(101L));

		service.report(5L, "POST", 77L, "SPAM", null);

		verify(posts).markUnderReview(77L);
		verify(adminNotifications, times(1)).create(any());
	}

	@Test
	void aPostTheReporterCannotSeeOrTheirOwnCannotBeReported() {
		com.linker.backend.entity.post.Post hidden = visiblePost(78L, 900L);
		org.mockito.Mockito.when(hidden.getVisibility())
				.thenReturn(com.linker.backend.entity.post.type.PostVisibility.UNDER_REVIEW);
		when(posts.findDetailedById(78L)).thenReturn(Optional.of(hidden));
		com.linker.backend.entity.post.Post own = visiblePost(79L, 5L);
		when(posts.findDetailedById(79L)).thenReturn(Optional.of(own));

		assertThatThrownBy(() -> service.report(5L, "POST", 78L, "SPAM", null))
				.isInstanceOf(ApiException.class)
				.satisfies(error -> assertThat(((ApiException) error).getStatus()).isEqualTo(404));
		assertThatThrownBy(() -> service.report(5L, "POST", 79L, "SPAM", null))
				.isInstanceOf(ApiException.class)
				.hasMessage("본인은 신고할 수 없어요");
		verify(posts, never()).markUnderReview(any(Long.class));
	}

	@Test
	void belowThresholdCommentReportLeavesTheCommentVisible() {
		long caseId = 61L;
		com.linker.backend.entity.post.Post post = visiblePost(77L, 900L);
		com.linker.backend.entity.post.Comment comment =
				org.mockito.Mockito.mock(com.linker.backend.entity.post.Comment.class);
		User commenter = User.create("commenter", UserType.DEVELOPER);
		ReflectionTestUtils.setField(commenter, "id", 901L);
		when(comment.getAuthor()).thenReturn(commenter);
		when(comment.getPost()).thenReturn(post);
		when(comment.getVisibility()).thenReturn(com.linker.backend.entity.post.type.PostVisibility.VISIBLE);
		when(comments.findDetailedById(12L)).thenReturn(Optional.of(comment));
		ReportCase reportCase = ReportCase.open(ReportTargetType.COMMENT, 12L, 901L);
		ReflectionTestUtils.setField(reportCase, "id", caseId);
		when(caseOpener.openPending(ReportTargetType.COMMENT, 12L, 901L)).thenReturn(caseId);
		when(cases.lockById(caseId)).thenReturn(Optional.of(reportCase));
		when(reports.countEligibleReporters(eq(caseId), any())).thenReturn(1L);

		service.report(5L, "COMMENT", 12L, "ABUSE", null);

		verify(comments, never()).markUnderReview(any(Long.class));
	}

	private static com.linker.backend.entity.post.Post visiblePost(long id, long authorId) {
		com.linker.backend.entity.post.Post post = org.mockito.Mockito.mock(
				com.linker.backend.entity.post.Post.class, org.mockito.Mockito.withSettings().strictness(
						org.mockito.quality.Strictness.LENIENT));
		User author = User.create("author-" + authorId, UserType.DEVELOPER);
		ReflectionTestUtils.setField(author, "id", authorId);
		org.mockito.Mockito.when(post.getId()).thenReturn(id);
		org.mockito.Mockito.when(post.getAuthor()).thenReturn(author);
		org.mockito.Mockito.when(post.getVisibility())
				.thenReturn(com.linker.backend.entity.post.type.PostVisibility.VISIBLE);
		return post;
	}

	private void stubNewReport(long caseId, ReportCase reportCase, long reporterId, long countAfterSave) {
		User target = User.create("target", UserType.DEVELOPER);
		ReflectionTestUtils.setField(target, "id", reportCase.getTargetUserId());
		when(users.findById(reportCase.getTargetUserId())).thenReturn(Optional.of(target));
		when(caseOpener.openPending(ReportTargetType.USER, reportCase.getTargetUserId(), reportCase.getTargetUserId()))
				.thenReturn(caseId);
		when(cases.lockById(caseId)).thenReturn(Optional.of(reportCase));
		when(reports.existsByReportCase_IdAndReporterId(caseId, reporterId)).thenReturn(false);
		when(reports.countEligibleReporters(eq(caseId), any())).thenReturn(countAfterSave);
	}

	private static ReportCase lockedCase(long caseId, long targetUserId, Instant autoHiddenAt) {
		ReportCase reportCase = ReportCase.open(ReportTargetType.USER, targetUserId, targetUserId);
		ReflectionTestUtils.setField(reportCase, "id", caseId);
		if (autoHiddenAt != null) {
			reportCase.markAutoHidden(autoHiddenAt);
		}
		return reportCase;
	}
}
