package com.linker.backend.service.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import com.linker.backend.dto.account.request.NotificationEmailRequest;
import com.linker.backend.dto.account.request.OnboardingAgreementsRequest;
import com.linker.backend.dto.account.request.OnboardingEmailRequest;
import com.linker.backend.dto.account.request.OnboardingProfileRequest;
import com.linker.backend.dto.account.request.ProfileUpdateRequest;
import com.linker.backend.dto.account.response.ProfileEditResponse;
import com.linker.backend.entity.account.AgreementType;
import com.linker.backend.entity.account.JobSeekingStatus;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.entity.profile.TechTag;
import com.linker.backend.entity.profile.UserTechTag;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.account.UserAgreementRepository;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.account.UserSessionRepository;
import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.entity.notification.NotificationTypes;
import com.linker.backend.repository.profile.FollowRepository;
import com.linker.backend.repository.profile.TechTagRepository;
import com.linker.backend.repository.profile.UserTechTagRepository;
import com.linker.backend.service.PublicLegalService;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class UserAccountServiceTest {

	private static final Instant NOW = Instant.parse("2026-11-05T10:00:00Z");
	private static final String VERSION = "2026-10-01";

	@Mock
	private UserRepository users;

	@Mock
	private UserAgreementRepository agreements;

	@Mock
	private TechTagRepository techTags;

	@Mock
	private UserTechTagRepository selectedTags;

	@Mock
	private PublicLegalService legal;

	@Mock
	private OwnedTeamLookup ownedTeams;

	@Mock
	private UserSessionRepository sessions;

	@Mock
	private FollowRepository follows;

	@Mock
	private UserNotificationService notifications;

	@Test
	void onboardingStartsAtAgreementsUsingTheLegalVersion() {
		User user = developer();
		when(users.findById(7L)).thenReturn(Optional.of(user));
		when(legal.termsVersion()).thenReturn(VERSION);
		when(agreements.existsByUser_IdAndAgreementTypeAndVersionAndWithdrawnAtIsNull(7L, AgreementType.AGE_14, VERSION))
				.thenReturn(false);
		when(selectedTags.findSelected(7L)).thenReturn(List.of());

		var response = service().onboarding(principal());

		assertThat(response.done()).isFalse();
		assertThat(response.step()).isEqualTo("AGREEMENTS");
		assertThat(response.termsVersion()).isEqualTo(VERSION);
		assertThat(response.emailRequired()).isTrue();
		assertThat(response.defaults().name()).isEqualTo("octocat");
		assertThat(response.defaults().jobStatus()).isEqualTo("OFF");
	}

	@Test
	void agreementsRejectAStaleTermsVersion() {
		when(legal.termsVersion()).thenReturn(VERSION);

		assertThatThrownBy(() -> service().acceptAgreements(principal(),
				new OnboardingAgreementsRequest(true, true, true, false, "2020-01-01")))
				.isInstanceOf(ApiException.class)
				.hasMessage("요청 값을 확인해 주세요");
	}

	@Test
	void profileSaveRequiresTheCurrentAgreementsAndFinishesOnboarding() {
		User user = developer();
		when(users.findById(7L)).thenReturn(Optional.of(user));
		when(legal.termsVersion()).thenReturn(VERSION);
		when(agreements.existsByUser_IdAndAgreementTypeAndVersionAndWithdrawnAtIsNull(7L, AgreementType.AGE_14, VERSION))
				.thenReturn(true);
		when(agreements.existsByUser_IdAndAgreementTypeAndVersionAndWithdrawnAtIsNull(7L, AgreementType.TERMS, VERSION))
				.thenReturn(true);
		when(agreements.existsByUser_IdAndAgreementTypeAndVersionAndWithdrawnAtIsNull(7L, AgreementType.PRIVACY, VERSION))
				.thenReturn(true);
		TechTag java = mock(TechTag.class);
		when(java.getName()).thenReturn("Java");
		when(techTags.findByNameIn(List.of("Java"))).thenReturn(List.of(java));

		service().saveProfile(principal(), new OnboardingProfileRequest(
				"명석", "백엔드", "https://blog.example", List.of("Java"), true, "SEEKING"));

		assertThat(user.getDisplayName()).isEqualTo("명석");
		assertThat(user.getBio()).isEqualTo("백엔드");
		assertThat(user.getBlogUrl()).isEqualTo("https://blog.example");
		assertThat(user.isLookingForTeam()).isTrue();
		assertThat(user.getJobSeekingStatus()).isEqualTo(JobSeekingStatus.OPEN);
		assertThat(user.isOnboarded()).isTrue();
		verify(selectedTags).deleteByUserId(7L);
		verify(selectedTags).save(any());
	}

	@Test
	void unknownTechTagIsRejected() {
		User user = developer();
		when(users.findById(7L)).thenReturn(Optional.of(user));
		when(legal.termsVersion()).thenReturn(VERSION);
		when(agreements.existsByUser_IdAndAgreementTypeAndVersionAndWithdrawnAtIsNull(7L, AgreementType.AGE_14, VERSION))
				.thenReturn(true);
		when(agreements.existsByUser_IdAndAgreementTypeAndVersionAndWithdrawnAtIsNull(7L, AgreementType.TERMS, VERSION))
				.thenReturn(true);
		when(agreements.existsByUser_IdAndAgreementTypeAndVersionAndWithdrawnAtIsNull(7L, AgreementType.PRIVACY, VERSION))
				.thenReturn(true);
		when(techTags.findByNameIn(List.of("Nope"))).thenReturn(List.of());

		assertThatThrownBy(() -> service().saveProfile(principal(), new OnboardingProfileRequest(
				"명석", "", "", List.of("Nope"), false, "OFF")))
				.isInstanceOf(ApiException.class)
				.hasMessage("기술 스택을 다시 선택해 주세요.");
		assertThat(user.isOnboarded()).isFalse();
	}

	@Test
	void emailIsStoredOnlyWhenGithubDidNotProvideOne() {
		User missing = developer();
		when(users.findById(7L)).thenReturn(Optional.of(missing));

		service().saveEmail(principal(), new OnboardingEmailRequest("me@example.com"));

		assertThat(missing.getEmail()).isEqualTo("me@example.com");

		User present = developer();
		ReflectionTestUtils.setField(present, "email", "github@example.com");
		when(users.findById(7L)).thenReturn(Optional.of(present));

		service().saveEmail(principal(), new OnboardingEmailRequest("other@example.com"));

		assertThat(present.getEmail()).isEqualTo("github@example.com");
	}

	@Test
	void settingsShowGithubAndAFreePlanUntilSubscriptionExists() {
		User user = developer();
		ReflectionTestUtils.setField(user, "email", "me@example.com");
		when(users.findById(7L)).thenReturn(Optional.of(user));

		var settings = service().settings(principal());

		assertThat(settings.github().login()).isEqualTo("octocat");
		assertThat(settings.github().connected()).isTrue();
		assertThat(settings.notificationEmail()).isEqualTo("me@example.com");
		assertThat(settings.pushEnabled()).isTrue();
		assertThat(settings.plan().name()).isEqualTo("FREE");
		assertThat(settings.plan().label()).isEqualTo("무료");
		assertThat(settings.plan().kind()).isEqualTo("FREE");

		User recruiter = User.create("recruiter", UserType.RECRUITER);
		ReflectionTestUtils.setField(recruiter, "id", 7L);
		when(users.findById(7L)).thenReturn(Optional.of(recruiter));

		assertThat(service().settings(principal()).github()).isNull();
	}

	@Test
	void changingNotificationEmailReplacesTheStoredAddress() {
		User user = developer();
		ReflectionTestUtils.setField(user, "email", "old@example.com");
		when(users.findById(7L)).thenReturn(Optional.of(user));

		var saved = service().changeEmail(principal(), new NotificationEmailRequest("new@example.com"));

		assertThat(saved.notificationEmail()).isEqualTo("new@example.com");
		assertThat(user.getEmail()).isEqualTo("new@example.com");
	}

	@Test
	void withdrawalCheckReturnsOnlyOwnedTeams() {
		when(users.findById(7L)).thenReturn(Optional.of(developer()));
		when(ownedTeams.ownedBy(7L)).thenReturn(List.of(new OwnedTeamLookup.OwnedTeam(3L, "링커")));

		var check = service().withdrawalCheck(principal());

		assertThat(check.ownedTeams()).containsExactly(new com.linker.backend.dto.account.response.WithdrawalCheckResponse.OwnedTeamResponse(3L, "링커"));
	}

	@Test
	void withdrawalRejectsAnOwnerAndOtherwiseClosesTheAccount() {
		User owner = developer();
		when(users.findById(7L)).thenReturn(Optional.of(owner));
		when(ownedTeams.ownedBy(7L)).thenReturn(List.of(new OwnedTeamLookup.OwnedTeam(3L, "링커")));

		assertThatThrownBy(() -> service().withdraw(principal()))
				.isInstanceOf(ApiException.class)
				.hasMessage("오너인 팀을 먼저 넘기거나 삭제해 주세요");
		assertThat(owner.getStatus()).isEqualTo(UserStatus.ACTIVE);

		when(ownedTeams.ownedBy(7L)).thenReturn(List.of());
		var result = service().withdraw(principal());

		assertThat(owner.getStatus()).isEqualTo(UserStatus.WITHDRAWING);
		assertThat(result.deletesOn()).isEqualTo("2026-12-05");
		verify(sessions).revokeActive(7L, NOW);
	}

	@Test
	void expiredWithdrawalIsAnonymizedWithoutTouchingMissingContentTables() {
		User user = developer();
		user.changeDisplayName("명석");
		user.changeNotificationEmail("me@example.com");
		user.markWithdrawing(NOW.minusSeconds(31L * 24 * 60 * 60));
		ReflectionTestUtils.setField(user, "id", 7L);
		when(users.findByStatusAndWithdrawRequestedAtLessThanEqual(UserStatus.WITHDRAWING, NOW.minusSeconds(30L * 24 * 60 * 60)))
				.thenReturn(List.of(user));

		service().anonymizeExpiredWithdrawals(NOW);

		assertThat(user.getStatus()).isEqualTo(UserStatus.DELETED);
		assertThat(user.getDisplayName()).isNull();
		assertThat(user.getEmail()).isNull();
		assertThat(user.getUsername()).isEqualTo("octocat");
		verify(sessions).revokeActive(7L, NOW);
	}

	private UserAccountService service() {
		return new UserAccountService(
				users, agreements, techTags, selectedTags, legal, ownedTeams, sessions, follows, notifications,
				Clock.fixed(NOW, ZoneOffset.UTC));
	}

	@Test
	void followNotifiesOnceAndRejectsARecruiterTarget() {
		User follower = developer();
		User target = developer();
		ReflectionTestUtils.setField(target, "id", 8L);
		ReflectionTestUtils.setField(target, "username", "hubot");
		when(users.findById(7L)).thenReturn(Optional.of(follower));
		when(users.findByUsername("hubot")).thenReturn(Optional.of(target));
		when(follows.existsByFollower_IdAndFollowing_Id(7L, 8L)).thenReturn(false, true);
		when(follows.countByFollower_IdAndCreatedAtGreaterThanEqual(7L, Instant.parse("2026-11-04T15:00:00Z")))
				.thenReturn(0L);

		service().follow(principal(), "hubot");
		service().follow(principal(), "hubot");

		verify(notifications).create(new CreateNotificationCommand(
				8L, NotificationTypes.FOLLOW, 7L, "USER", 7L, "/u/octocat", null, null));
		verify(follows).save(any());

		User recruiter = User.create("r-1", UserType.RECRUITER);
		ReflectionTestUtils.setField(recruiter, "id", 9L);
		when(users.findByUsername("r-1")).thenReturn(Optional.of(recruiter));
		assertThatThrownBy(() -> service().follow(principal(), "r-1"))
				.isInstanceOf(ApiException.class)
				.hasMessage("채용 담당자는 팔로우할 수 없어요");
	}

	@Test
	void followStopsAtTheDailyLimit() {
		User follower = developer();
		User target = developer();
		ReflectionTestUtils.setField(target, "id", 8L);
		ReflectionTestUtils.setField(target, "username", "hubot");
		when(users.findById(7L)).thenReturn(Optional.of(follower));
		when(users.findByUsername("hubot")).thenReturn(Optional.of(target));
		when(follows.existsByFollower_IdAndFollowing_Id(7L, 8L)).thenReturn(false);
		when(follows.countByFollower_IdAndCreatedAtGreaterThanEqual(anyLong(), any())).thenReturn(200L);

		assertThatThrownBy(() -> service().follow(principal(), "hubot"))
				.isInstanceOf(ApiException.class)
				.hasMessage("팔로우는 하루에 200명까지 할 수 있어요");
		verify(notifications, never()).create(any());
	}

	@Test
	void profileEditReusesOnboardingRulesAndLeavesJobCategoriesEmpty() {
		User user = developer();
		user.applyOnboardingProfile("명석", "백엔드", "https://blog.example", true, JobSeekingStatus.OPEN, NOW);
		when(users.findById(7L)).thenReturn(Optional.of(user));
		UserTechTag selected = mock(UserTechTag.class);
		when(selected.tagName()).thenReturn("Java");
		when(selectedTags.findSelected(7L)).thenReturn(List.of(selected));

		ProfileEditResponse current = service().profile(principal());

		assertThat(current.kind()).isEqualTo("DEVELOPER");
		assertThat(current.name()).isEqualTo("명석");
		assertThat(current.bio()).isEqualTo("백엔드");
		assertThat(current.blogUrl()).isEqualTo("https://blog.example");
		assertThat(current.techStack()).containsExactly("Java");
		assertThat(current.lookingForTeam()).isTrue();
		assertThat(current.jobStatus()).isEqualTo("SEEKING");
		assertThat(current.jobCategories()).isEmpty();
		assertThatThrownBy(() -> service().updateProfile(principal(), new ProfileUpdateRequest(
				"새 이름", "소개", "http://blog.example", List.of("Spring"), false, "OPEN")))
				.isInstanceOf(ApiException.class)
				.hasMessage("블로그 주소는 https로 시작해야 해요.");

		TechTag spring = mock(TechTag.class);
		when(spring.getName()).thenReturn("Spring");
		when(techTags.findByNameIn(List.of("Spring"))).thenReturn(List.of(spring));
		UserTechTag savedTag = mock(UserTechTag.class);
		when(savedTag.tagName()).thenReturn("Spring");
		when(selectedTags.findSelected(7L)).thenReturn(List.of(savedTag));

		ProfileEditResponse saved = service().updateProfile(principal(), new ProfileUpdateRequest(
				"새 이름", "소개", "https://notes.example", List.of("Spring"), false, "OPEN"));

		assertThat(saved.name()).isEqualTo("새 이름");
		assertThat(saved.blogUrl()).isEqualTo("https://notes.example");
		assertThat(saved.techStack()).containsExactly("Spring");
		assertThat(saved.lookingForTeam()).isFalse();
		assertThat(saved.jobStatus()).isEqualTo("OPEN");
		assertThat(saved.jobCategories()).isEmpty();
		assertThat(user.getJobSeekingStatus()).isEqualTo(JobSeekingStatus.OFFERS_ONLY);
		assertThat(user.isOnboarded()).isFalse();
	}

	@Test
	void inactivityTurnsLookingForTeamOffAt30DaysAndJobSeekingOffAt90Days() {
		User recent = developer();
		recent.applyOnboardingProfile("명석", "", null, true, JobSeekingStatus.OPEN, NOW);
		recent.touch(NOW.minus(40, ChronoUnit.DAYS));
		when(users.findInactiveDevelopers(NOW.minus(30, ChronoUnit.DAYS))).thenReturn(List.of(recent));

		service().settleInactiveProfiles(NOW);

		assertThat(recent.isLookingForTeam()).isFalse();
		assertThat(recent.getJobSeekingStatus()).isEqualTo(JobSeekingStatus.OPEN);
		verify(notifications, never()).create(any());

		User quiet = developer();
		quiet.applyOnboardingProfile("명석", "", null, true, JobSeekingStatus.OFFERS_ONLY, NOW);
		quiet.touch(NOW.minus(90, ChronoUnit.DAYS));
		when(users.findInactiveDevelopers(NOW.minus(30, ChronoUnit.DAYS))).thenReturn(List.of(quiet));
		when(users.findById(7L)).thenReturn(Optional.of(quiet));

		service().settleInactiveProfiles(NOW);
		service().deliverJobSeekingOffNotice(7L);
		service().deliverJobSeekingOffNotice(7L);

		assertThat(quiet.isLookingForTeam()).isFalse();
		assertThat(quiet.getJobSeekingStatus()).isEqualTo(JobSeekingStatus.OFF);
		verify(notifications).create(new CreateNotificationCommand(
				7L,
				NotificationTypes.JOB_SEEKING_OFF,
				null,
				null,
				null,
				"/settings/profile",
				"{\"message\":\"구직 상태를 껐어요\"}",
				null));
	}

	private static User developer() {
		User user = User.create("octocat", UserType.DEVELOPER);
		ReflectionTestUtils.setField(user, "id", 7L);
		return user;
	}

	private static AuthenticatedUser principal() {
		return new AuthenticatedUser(
				7L, "octocat", UserType.DEVELOPER, UserStatus.ACTIVE, null, false, false, false, 9L);
	}
}
