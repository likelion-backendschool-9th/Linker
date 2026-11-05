package com.linker.backend.service.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.entity.recruit.Application;
import com.linker.backend.entity.recruit.ApplicationStatus;
import com.linker.backend.entity.recruit.RecruitPost;
import com.linker.backend.entity.recruit.RecruitRole;
import com.linker.backend.entity.recruit.RecruitRoleType;
import com.linker.backend.entity.recruit.WorkMode;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.recruit.ApplicationRepository;
import com.linker.backend.repository.recruit.RecruitPostRepository;
import com.linker.backend.service.recruit.RecruitCardMapper;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class UserRecruitmentServiceTest {

	@Mock
	RecruitPostRepository posts;
	@Mock
	ApplicationRepository applications;

	UserRecruitmentService service;
	AuthenticatedUser developer;

	@BeforeEach
	void setUp() {
		service = new UserRecruitmentService(posts, applications, new RecruitCardMapper());
		developer = new AuthenticatedUser(
				10L, "dev", UserType.DEVELOPER,
				com.linker.backend.entity.account.UserStatus.ACTIVE,
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
