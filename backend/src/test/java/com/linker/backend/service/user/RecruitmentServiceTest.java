package com.linker.backend.service.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.dto.recruit.request.AcceptApplicationRequest;
import com.linker.backend.dto.recruit.request.ApplyRecruitRequest;
import com.linker.backend.dto.recruit.request.RecruitRoleWriteRequest;
import com.linker.backend.dto.recruit.request.RecruitWriteRequest;
import com.linker.backend.dto.recruit.request.RejectApplicationRequest;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.notification.type.NotificationTypes;
import com.linker.backend.entity.recruit.Application;
import com.linker.backend.entity.recruit.type.ApplicationStatus;
import com.linker.backend.entity.recruit.RecruitPost;
import com.linker.backend.entity.recruit.RecruitRole;
import com.linker.backend.entity.recruit.type.RecruitRoleType;
import com.linker.backend.entity.recruit.type.RecruitStatus;
import com.linker.backend.entity.recruit.type.WorkMode;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.moderation.UserBlockRepository;
import com.linker.backend.repository.profile.TechTagRepository;
import com.linker.backend.repository.recruit.ApplicationRepository;
import com.linker.backend.repository.recruit.RecruitPostRepository;
import com.linker.backend.dto.recruit.mapper.RecruitCardMapper;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class RecruitmentServiceTest {

	private static final Instant NOW = Instant.parse("2026-11-05T01:00:00Z");
	private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

	@Mock
	RecruitPostRepository posts;
	@Mock
	ApplicationRepository applications;
	@Mock
	UserRepository users;
	@Mock
	TechTagRepository techTags;
	@Mock
	UserBlockRepository blocks;
	@Mock
	NotificationService notifications;

	RecruitmentService service;
	AuthenticatedUser developer;

	@BeforeEach
	void setUp() {
		service = new RecruitmentService(
				posts, applications, users, techTags, blocks, new RecruitCardMapper(), notifications, CLOCK);
		developer = new AuthenticatedUser(
				10L, "dev", UserType.DEVELOPER,
				UserStatus.ACTIVE,
				null, false, false, true, 1L);
	}

	@Test
	void cancelPendingApplicationOwnedByCaller() {
		Application application = pendingApplication(10L, ApplicationStatus.PENDING);
		when(applications.findDetailedById(7L)).thenReturn(Optional.of(application));

		service.cancelApplication(developer, 7L);

		assertThat(application.getStatus()).isEqualTo(ApplicationStatus.CANCELED);
	}

	@Test
	void cancelRejectsNonPending() {
		Application application = pendingApplication(10L, ApplicationStatus.ACCEPTED);
		when(applications.findDetailedById(7L)).thenReturn(Optional.of(application));

		assertThatThrownBy(() -> service.cancelApplication(developer, 7L))
				.isInstanceOf(ApiException.class)
				.satisfies(error -> assertThat(((ApiException) error).getCode()).isEqualTo("NOT_PENDING"));
	}

	@Test
	void cancelHidesOtherUsersApplications() {
		Application application = pendingApplication(99L, ApplicationStatus.PENDING);
		when(applications.findDetailedById(7L)).thenReturn(Optional.of(application));

		assertThatThrownBy(() -> service.cancelApplication(developer, 7L))
				.isInstanceOf(ApiException.class)
				.satisfies(error -> assertThat(((ApiException) error).getCode()).isEqualTo("NOT_FOUND"));
	}

	@Test
	void myApplicationsSkipsCanceledFilterValue() {
		when(applications.findMine(eq(10L), eq(null), eq(ApplicationStatus.CANCELED), any(Pageable.class)))
				.thenReturn(List.of());

		assertThat(service.myApplications(developer, null, null).items()).isEmpty();
		verify(applications).findMine(eq(10L), eq(null), eq(ApplicationStatus.CANCELED), any(Pageable.class));
	}

	@Test
	void editorOptionsUsesFreeOpenLimitAndEmptyTeams() {
		when(posts.countByAuthorIdAndStatusAndDeletedAtIsNull(10L, RecruitStatus.OPEN)).thenReturn(1L);

		var options = service.editorOptions(developer);

		assertThat(options.teams()).isEmpty();
		assertThat(options.openCount()).isEqualTo(1);
		assertThat(options.openLimit()).isEqualTo(PlanLimits.OPEN_RECRUIT_POSTS_FREE);
		assertThat(options.maxDeadlineDate()).isEqualTo(LocalDate.of(2026, 11, 5).plusDays(60).toString());
	}

	@Test
	void createPersistsOpenPost() {
		User author = User.create("dev", UserType.DEVELOPER);
		ReflectionTestUtils.setField(author, "id", 10L);
		when(posts.countByAuthorIdAndStatusAndDeletedAtIsNull(10L, RecruitStatus.OPEN)).thenReturn(0L);
		when(users.findById(10L)).thenReturn(Optional.of(author));
		when(posts.save(any(RecruitPost.class))).thenAnswer(invocation -> {
			RecruitPost post = invocation.getArgument(0);
			ReflectionTestUtils.setField(post, "id", 42L);
			return post;
		});

		var response = service.create(developer, writeRequest(null));

		assertThat(response.id()).isEqualTo(42L);
		ArgumentCaptor<RecruitPost> captor = ArgumentCaptor.forClass(RecruitPost.class);
		verify(posts).save(captor.capture());
		assertThat(captor.getValue().getStatus()).isEqualTo(RecruitStatus.OPEN);
		assertThat(captor.getValue().getTitle()).isEqualTo("함께 만들어요");
		assertThat(captor.getValue().getRoles()).hasSize(1);
	}

	@Test
	void createRejectsWhenOpenLimitReached() {
		when(posts.countByAuthorIdAndStatusAndDeletedAtIsNull(10L, RecruitStatus.OPEN))
				.thenReturn((long) PlanLimits.OPEN_RECRUIT_POSTS_FREE);

		assertThatThrownBy(() -> service.create(developer, writeRequest(null)))
				.isInstanceOf(ApiException.class)
				.satisfies(error -> {
					ApiException api = (ApiException) error;
					assertThat(api.getCode()).isEqualTo("PLAN_LIMIT");
					assertThat(api.getDetail()).containsEntry("reason", "RECRUIT_POSTS");
				});
		verify(posts, never()).save(any());
	}

	@Test
	void createRejectsOfflineWithoutRegion() {
		when(posts.countByAuthorIdAndStatusAndDeletedAtIsNull(10L, RecruitStatus.OPEN)).thenReturn(0L);
		RecruitWriteRequest request = new RecruitWriteRequest(
				"함께 만들어요",
				"소개입니다",
				List.of(new RecruitRoleWriteRequest(null, "BACKEND", 2)),
				"OFFLINE",
				null,
				null,
				null,
				LocalDate.of(2026, 11, 12).toString(),
				List.of(),
				null
		);

		assertThatThrownBy(() -> service.create(developer, request))
				.isInstanceOf(ApiException.class)
				.satisfies(error -> assertThat(((ApiException) error).getCode()).isEqualTo("VALIDATION_ERROR"));
	}

	@Test
	void editFormRequiresAuthor() {
		RecruitPost post = ownedPost();
		when(posts.findDetailedById(3L)).thenReturn(Optional.of(post));
		when(applications.findLockedRoleIds(3L, ApplicationStatus.CANCELED)).thenReturn(List.of(5L));

		var form = service.editForm(developer, 3L);

		assertThat(form.id()).isEqualTo(3L);
		assertThat(form.lockedRoleIds()).containsExactly(5L);
		assertThat(form.minHeadcountByRole()).isEqualTo(Map.of("5", 0));
	}

	@Test
	void updateRejectsDeletingLockedRole() {
		RecruitPost post = ownedPost();
		when(posts.findDetailedById(3L)).thenReturn(Optional.of(post));
		when(applications.findLockedRoleIds(3L, ApplicationStatus.CANCELED)).thenReturn(List.of(5L));

		RecruitWriteRequest request = new RecruitWriteRequest(
				"함께 만들어요",
				"소개입니다",
				List.of(new RecruitRoleWriteRequest(null, "FRONTEND", 1)),
				"ONLINE",
				null,
				null,
				null,
				LocalDate.of(2026, 11, 12).toString(),
				List.of(),
				null
		);

		assertThatThrownBy(() -> service.update(developer, 3L, request))
				.isInstanceOf(ApiException.class)
				.satisfies(error -> assertThat(((ApiException) error).getCode()).isEqualTo("ROLE_LOCKED"));
	}

	@Test
	void closeAndReopenToggleStatus() {
		RecruitPost post = ownedPost();
		when(posts.findDetailedById(3L)).thenReturn(Optional.of(post));
		when(posts.countByAuthorIdAndStatusAndDeletedAtIsNull(10L, RecruitStatus.OPEN)).thenReturn(0L);

		service.close(developer, 3L);
		assertThat(post.getStatus()).isEqualTo(RecruitStatus.CLOSED);

		service.reopen(developer, 3L);
		assertThat(post.getStatus()).isEqualTo(RecruitStatus.OPEN);
	}

	@Test
	void reopenRejectsWhenOpenLimitReached() {
		RecruitPost post = ownedPost();
		post.close(NOW);
		when(posts.findDetailedById(3L)).thenReturn(Optional.of(post));
		when(posts.countByAuthorIdAndStatusAndDeletedAtIsNull(10L, RecruitStatus.OPEN))
				.thenReturn((long) PlanLimits.OPEN_RECRUIT_POSTS_FREE);

		assertThatThrownBy(() -> service.reopen(developer, 3L))
				.isInstanceOf(ApiException.class)
				.satisfies(error -> assertThat(((ApiException) error).getCode()).isEqualTo("PLAN_LIMIT"));
	}

	@Test
	void deleteExpiresPendingApplicationsAndNotifies() {
		RecruitPost post = ownedPost();
		Application pending = pendingApplication(20L, ApplicationStatus.PENDING);
		when(posts.findDetailedById(3L)).thenReturn(Optional.of(post));
		when(applications.findPendingByRecruitPostId(3L, ApplicationStatus.PENDING))
				.thenReturn(List.of(pending));

		service.delete(developer, 3L);

		assertThat(pending.getStatus()).isEqualTo(ApplicationStatus.EXPIRED);
		assertThat(post.getDeletedAt()).isEqualTo(NOW);
		ArgumentCaptor<CreateNotificationCommand> captor =
				ArgumentCaptor.forClass(CreateNotificationCommand.class);
		verify(notifications).create(captor.capture());
		assertThat(captor.getValue().notificationType()).isEqualTo(NotificationTypes.APPLICATION_EXPIRED);
		assertThat(captor.getValue().recipientUserId()).isEqualTo(20L);
	}

	@Test
	void autoCloseClosesPastDeadlineOrFullPosts() {
		RecruitPost pastDeadline = ownedPost();
		ReflectionTestUtils.setField(pastDeadline, "deadline", LocalDate.of(2026, 11, 4));
		RecruitPost full = ownedPost();
		ReflectionTestUtils.setField(full, "id", 4L);
		RecruitRole role = full.getRoles().getFirst();
		ReflectionTestUtils.setField(role, "acceptedCount", role.getHeadcount());
		RecruitPost stillOpen = ownedPost();
		ReflectionTestUtils.setField(stillOpen, "id", 5L);
		when(posts.findOpenWithRoles(RecruitStatus.OPEN))
				.thenReturn(new ArrayList<>(List.of(pastDeadline, full, stillOpen)));

		assertThat(service.autoCloseEligiblePosts()).isEqualTo(2);
		assertThat(pastDeadline.getStatus()).isEqualTo(RecruitStatus.CLOSED);
		assertThat(full.getStatus()).isEqualTo(RecruitStatus.CLOSED);
		assertThat(stillOpen.getStatus()).isEqualTo(RecruitStatus.OPEN);
	}

	@Test
	void applyCreatesPendingAndNotifiesAuthor() {
		RecruitPost post = foreignPost();
		User applicant = User.create("dev", UserType.DEVELOPER);
		ReflectionTestUtils.setField(applicant, "id", 10L);
		when(posts.findDetailedById(8L)).thenReturn(Optional.of(post));
		when(applications.findByRecruitPostIdAndApplicantId(8L, 10L)).thenReturn(List.of());
		when(users.findById(10L)).thenReturn(Optional.of(applicant));
		when(applications.save(any(Application.class))).thenAnswer(invocation -> {
			Application application = invocation.getArgument(0);
			ReflectionTestUtils.setField(application, "id", 70L);
			return application;
		});

		var response = service.apply(developer, 8L, new ApplyRecruitRequest(5L, "참여하고 싶어요"));

		assertThat(response.id()).isEqualTo(70L);
		assertThat(response.status()).isEqualTo("PENDING");
		verify(notifications).create(any(CreateNotificationCommand.class));
	}

	@Test
	void applyRejectsOwnPost() {
		when(posts.findDetailedById(3L)).thenReturn(Optional.of(ownedPost()));

		assertThatThrownBy(() -> service.apply(developer, 3L, new ApplyRecruitRequest(5L, "hi")))
				.isInstanceOf(ApiException.class)
				.satisfies(error -> assertThat(((ApiException) error).getCode()).isEqualTo("FORBIDDEN"));
	}

	@Test
	void applyRejectsClosedPost() {
		RecruitPost post = foreignPost();
		post.close(NOW);
		when(posts.findDetailedById(8L)).thenReturn(Optional.of(post));

		assertThatThrownBy(() -> service.apply(developer, 8L, new ApplyRecruitRequest(5L, "hi")))
				.isInstanceOf(ApiException.class)
				.satisfies(error -> assertThat(((ApiException) error).getCode()).isEqualTo("RECRUIT_CLOSED"));
	}

	@Test
	void acceptRequiresTeam() {
		RecruitPost post = ownedPost();
		Application application = pendingOn(post, 20L);
		when(posts.findDetailedById(3L)).thenReturn(Optional.of(post));
		when(applications.findDetailedForPost(3L, 7L)).thenReturn(Optional.of(application));

		assertThatThrownBy(() -> service.accept(developer, 3L, 7L, null))
				.isInstanceOf(ApiException.class)
				.satisfies(error -> assertThat(((ApiException) error).getCode()).isEqualTo("TEAM_REQUIRED"));
	}

	@Test
	void acceptRejectsWhenRoleFullWithoutIncrease() {
		RecruitPost post = ownedPost();
		post.assignTeam(100L);
		RecruitRole role = post.getRoles().getFirst();
		ReflectionTestUtils.setField(role, "acceptedCount", role.getHeadcount());
		Application application = pendingOn(post, 20L);
		when(posts.findDetailedById(3L)).thenReturn(Optional.of(post));
		when(applications.findDetailedForPost(3L, 7L)).thenReturn(Optional.of(application));

		assertThatThrownBy(() -> service.accept(developer, 3L, 7L, new AcceptApplicationRequest(false)))
				.isInstanceOf(ApiException.class)
				.satisfies(error -> {
					ApiException api = (ApiException) error;
					assertThat(api.getCode()).isEqualTo("ROLE_FULL");
					assertThat(api.getDetail()).containsEntry("roleId", 5L);
				});
	}

	@Test
	void rejectMarksRejectedAndNotifiesWithoutExposingReasonToSheet() {
		RecruitPost post = ownedPost();
		Application application = pendingOn(post, 20L);
		User author = post.getAuthor();
		when(posts.findDetailedById(3L)).thenReturn(Optional.of(post));
		when(applications.findDetailedForPost(3L, 7L)).thenReturn(Optional.of(application));
		when(users.findById(10L)).thenReturn(Optional.of(author));

		service.reject(developer, 3L, 7L, new RejectApplicationRequest("내부 메모"));

		assertThat(application.getStatus()).isEqualTo(ApplicationStatus.REJECTED);
		assertThat(application.getRejectReason()).isEqualTo("내부 메모");
		var sheet = service.applicationSheet(developer, 3L, 7L);
		assertThat(sheet.status()).isEqualTo("REJECTED");
		assertThat(sheet.message()).isEqualTo("hello");
		ArgumentCaptor<CreateNotificationCommand> captor =
				ArgumentCaptor.forClass(CreateNotificationCommand.class);
		verify(notifications).create(captor.capture());
		assertThat(captor.getValue().notificationType()).isEqualTo(NotificationTypes.APPLICATION_REJECTED);
	}

	@Test
	void expireOverdueApplicationsNotifiesApplicants() {
		RecruitPost post = ownedPost();
		Application overdue = pendingOn(post, 20L);
		ReflectionTestUtils.setField(overdue, "expiresAt", NOW.minusSeconds(60));
		when(applications.findExpiredPending(ApplicationStatus.PENDING, NOW)).thenReturn(List.of(overdue));

		assertThat(service.expireOverdueApplications()).isEqualTo(1);
		assertThat(overdue.getStatus()).isEqualTo(ApplicationStatus.EXPIRED);
		verify(notifications).create(any(CreateNotificationCommand.class));
	}

	private RecruitWriteRequest writeRequest(Long roleId) {
		return new RecruitWriteRequest(
				"함께 만들어요",
				"소개입니다",
				List.of(new RecruitRoleWriteRequest(roleId, "BACKEND", 2)),
				"ONLINE",
				null,
				"LAUNCH",
				"2주",
				LocalDate.of(2026, 11, 12).toString(),
				List.of(),
				null
		);
	}

	private RecruitPost ownedPost() {
		User author = User.create("dev", UserType.DEVELOPER);
		ReflectionTestUtils.setField(author, "id", 10L);
		RecruitPost post = RecruitPost.open(
				author, "title", "desc", WorkMode.ONLINE, null, null, null,
				LocalDate.of(2026, 11, 12), NOW);
		ReflectionTestUtils.setField(post, "id", 3L);
		ReflectionTestUtils.setField(post, "createdAt", NOW);
		RecruitRole role = RecruitRole.of(RecruitRoleType.BACKEND, 2);
		post.addRole(role);
		ReflectionTestUtils.setField(role, "id", 5L);
		return post;
	}

	private RecruitPost foreignPost() {
		User author = User.create("author", UserType.DEVELOPER);
		ReflectionTestUtils.setField(author, "id", 1L);
		RecruitPost post = RecruitPost.open(
				author, "title", "desc", WorkMode.ONLINE, null, null, null,
				LocalDate.of(2026, 11, 12), NOW);
		ReflectionTestUtils.setField(post, "id", 8L);
		ReflectionTestUtils.setField(post, "createdAt", NOW);
		RecruitRole role = RecruitRole.of(RecruitRoleType.BACKEND, 2);
		post.addRole(role);
		ReflectionTestUtils.setField(role, "id", 5L);
		return post;
	}

	private Application pendingOn(RecruitPost post, long applicantId) {
		User applicant = User.create("applicant", UserType.DEVELOPER);
		ReflectionTestUtils.setField(applicant, "id", applicantId);
		RecruitRole role = post.getRoles().getFirst();
		Application application = Application.pending(
				post, role, applicant, "hello", 1, NOW.plusSeconds(14L * 86_400L));
		ReflectionTestUtils.setField(application, "id", 7L);
		ReflectionTestUtils.setField(application, "createdAt", NOW);
		return application;
	}

	private static Application pendingApplication(long applicantId, ApplicationStatus status) {
		User author = User.create("author", UserType.DEVELOPER);
		ReflectionTestUtils.setField(author, "id", 1L);
		User applicant = User.create("applicant", UserType.DEVELOPER);
		ReflectionTestUtils.setField(applicant, "id", applicantId);
		RecruitPost post = RecruitPost.open(
				author, "title", "desc", WorkMode.ONLINE, null, null, null,
				LocalDate.now().plusDays(7), Instant.parse("2026-11-05T00:00:00Z"));
		ReflectionTestUtils.setField(post, "id", 3L);
		ReflectionTestUtils.setField(post, "createdAt", Instant.parse("2026-11-05T00:00:00Z"));
		RecruitRole role = RecruitRole.of(RecruitRoleType.BACKEND, 2);
		post.addRole(role);
		ReflectionTestUtils.setField(role, "id", 5L);
		Application application = Application.pending(
				post, role, applicant, "hello", 1, Instant.parse("2026-11-19T00:00:00Z"));
		ReflectionTestUtils.setField(application, "id", 7L);
		ReflectionTestUtils.setField(application, "status", status);
		ReflectionTestUtils.setField(application, "createdAt", Instant.parse("2026-11-05T01:00:00Z"));
		return application;
	}
}
