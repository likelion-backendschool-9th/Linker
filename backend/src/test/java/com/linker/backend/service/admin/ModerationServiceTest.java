package com.linker.backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import com.linker.backend.dto.moderation.request.AppealDecisionRequest;
import com.linker.backend.dto.moderation.request.ReportActionRequest;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.moderation.Admin;
import com.linker.backend.entity.moderation.type.AdminRole;
import com.linker.backend.entity.moderation.Appeal;
import com.linker.backend.entity.moderation.type.AppealStatus;
import com.linker.backend.entity.moderation.ReportCase;
import com.linker.backend.entity.moderation.type.ReportCaseStatus;
import com.linker.backend.entity.moderation.type.ReportTargetType;
import com.linker.backend.entity.moderation.Sanction;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.github.GithubTokenCipher;
import com.linker.backend.repository.account.RecruiterProfileRepository;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.account.UserSessionRepository;
import com.linker.backend.repository.profile.RecruiterAdRepository;
import com.linker.backend.repository.moderation.AdminActionRepository;
import com.linker.backend.repository.moderation.AdminRepository;
import com.linker.backend.repository.moderation.AppealRepository;
import com.linker.backend.repository.moderation.ReportCaseRepository;
import com.linker.backend.repository.moderation.ReportMessageSnapshotRepository;
import com.linker.backend.repository.moderation.ReportRepository;
import com.linker.backend.repository.moderation.SanctionRepository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ModerationServiceTest {

	private static final Instant NOW = Instant.parse("2026-11-05T10:00:00Z");

	@Mock
	private ReportCaseRepository cases;
	@Mock
	private ReportRepository reports;
	@Mock
	private ReportMessageSnapshotRepository snapshots;
	@Mock
	private SanctionRepository sanctions;
	@Mock
	private AppealRepository appeals;
	@Mock
	private AdminActionRepository actions;
	@Mock
	private AdminRepository admins;
	@Mock
	private UserRepository users;
	@Mock
	private RecruiterAdRepository ads;
	@Mock
	private RecruiterProfileRepository profiles;
	@Mock
	private NotificationService notifications;
	@Mock
	private GithubTokenCipher otpSecrets;
	@Mock
	private UserSessionRepository sessions;
	@Mock
	private ReportContentEffects content;

	@Test
	void hideRequiresAReasonAndDoesNotRecordAnAction() {
		Admin admin = operator(3L);
		ReportCase row = pendingCase();
		when(admins.findByUser_Id(7L)).thenReturn(Optional.of(admin));
		when(cases.lockById(4L)).thenReturn(Optional.of(row));

		assertThatThrownBy(() -> service().act(principal(), 4L, new ReportActionRequest("HIDE", "  ")))
				.isInstanceOf(ApiException.class)
				.hasMessage("사유를 입력해 주세요");
		verify(actions, never()).save(any());
	}

	@Test
	void fifthDismissalRestrictsTheReporter() {
		Admin admin = operator(3L);
		ReportCase row = pendingCase();
		User author = User.create("octocat", UserType.DEVELOPER);
		ReflectionTestUtils.setField(author, "id", 8L);
		User reporter = User.create("hubot", UserType.DEVELOPER);
		ReflectionTestUtils.setField(reporter, "id", 9L);
		when(admins.findByUser_Id(7L)).thenReturn(Optional.of(admin));
		when(cases.lockById(4L)).thenReturn(Optional.of(row));
		when(reports.findReporterIdsByReportCaseId(4L)).thenReturn(List.of(9L));
		when(reports.countDismissedSince(org.mockito.ArgumentMatchers.eq(9L), any())).thenReturn(5L);
		when(users.findById(9L)).thenReturn(Optional.of(reporter));
		when(users.findById(8L)).thenReturn(Optional.of(author));
		when(reports.findByReportCase_Id(4L)).thenReturn(List.of());
		when(appeals.findPendingCaseIds()).thenReturn(List.of());
		when(actions.findFirstByReportCase_IdAndActionInOrderByIdDesc(org.mockito.ArgumentMatchers.eq(4L), any()))
				.thenReturn(Optional.empty());

		var saved = service().act(principal(), 4L, new ReportActionRequest("DISMISS", null));

		assertThat(row.getStatus()).isEqualTo(ReportCaseStatus.DISMISSED);
		assertThat(saved.status()).isEqualTo("HANDLED");
		verify(sanctions).save(any(Sanction.class));
		verify(notifications, org.mockito.Mockito.atLeastOnce()).create(any());
	}

	@Test
	void originalHandlerCannotDecideTheAppeal() {
		Admin reviewer = operator(3L);
		Admin original = reviewer;
		User reporter = User.create("hubot", UserType.DEVELOPER);
		ReflectionTestUtils.setField(reporter, "id", 9L);
		Sanction sanction = Sanction.reportRestriction(reporter, pendingCase(), original, NOW, NOW.plusSeconds(3600));
		Appeal appeal = Appeal.open(reporter, sanction, "다시 봐 주세요");
		ReflectionTestUtils.setField(appeal, "id", 11L);
		when(admins.findByUser_Id(7L)).thenReturn(Optional.of(reviewer));
		when(appeals.findById(11L)).thenReturn(Optional.of(appeal));

		assertThatThrownBy(() -> service().decideAppeal(principal(), 11L, new AppealDecisionRequest(true, "")))
				.isInstanceOf(ApiException.class)
				.hasMessage("처음 처리한 운영자는 결정할 수 없어요");
		assertThat(appeal.getStatus()).isEqualTo(AppealStatus.PENDING);
	}

	@Test
	void acceptedAppealRevokesTheSanctionAndReopensTheCase() {
		Admin reviewer = operator(3L);
		Admin original = operator(9L);
		User reporter = User.create("hubot", UserType.DEVELOPER);
		ReflectionTestUtils.setField(reporter, "id", 9L);
		ReportCase row = pendingCase();
		row.resolve(ReportCaseStatus.ACTIONED, 9L, NOW);
		Sanction sanction = Sanction.reportRestriction(reporter, row, original, NOW, NOW.plusSeconds(3600));
		Appeal appeal = Appeal.open(reporter, sanction, "다시 봐 주세요");
		ReflectionTestUtils.setField(appeal, "id", 11L);
		when(admins.findByUser_Id(7L)).thenReturn(Optional.of(reviewer));
		when(appeals.findById(11L)).thenReturn(Optional.of(appeal));

		service().decideAppeal(principal(), 11L, new AppealDecisionRequest(true, "수용"));

		assertThat(appeal.getStatus()).isEqualTo(AppealStatus.ACCEPTED);
		assertThat(sanction.getRevokedAt()).isEqualTo(NOW);
		assertThat(row.getStatus()).isEqualTo(ReportCaseStatus.PENDING);
	}

	private ModerationService service() {
		return new ModerationService(
				cases, reports, snapshots, sanctions, appeals, actions, admins, users, ads, profiles, notifications,
				otpSecrets, sessions, content, Clock.fixed(NOW, ZoneOffset.UTC), org.mockito.Mockito.mock(UserAdministrationService.class));
	}

	private static Admin operator(long id) {
		User user = User.create("op-" + id, UserType.DEVELOPER);
		ReflectionTestUtils.setField(user, "id", id);
		Admin admin = Admin.assign(user, AdminRole.OPERATOR);
		ReflectionTestUtils.setField(admin, "id", id);
		return admin;
	}

	private static ReportCase pendingCase() {
		ReportCase row = ReportCase.open(ReportTargetType.USER, 8L, 8L);
		ReflectionTestUtils.setField(row, "id", 4L);
		return row;
	}

	private static AuthenticatedUser principal() {
		return new AuthenticatedUser(
				7L, "op-3", UserType.DEVELOPER, UserStatus.ACTIVE, null, true, true, true, 1L);
	}
}
