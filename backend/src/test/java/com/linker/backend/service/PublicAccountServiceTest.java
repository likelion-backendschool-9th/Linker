package com.linker.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import com.linker.backend.dto.account.response.PublicProfileResponse;
import com.linker.backend.dto.account.response.PublicTeamsResponse;
import com.linker.backend.entity.account.JobSeekingStatus;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.entity.profile.UsernameRedirect;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.github.GithubTokenCipher;
import com.linker.backend.integration.github.GithubUserAuthClient;
import com.linker.backend.repository.account.GithubTokenRepository;
import com.linker.backend.repository.account.RecruiterProfileRepository;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.moderation.UserBlockRepository;
import com.linker.backend.repository.profile.ContributionDayRepository;
import com.linker.backend.repository.profile.FollowRepository;
import com.linker.backend.repository.profile.PublicProfileQuery;
import com.linker.backend.repository.profile.UserTechTagRepository;
import com.linker.backend.repository.profile.UsernameRedirectRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;

@ExtendWith(MockitoExtension.class)
class PublicAccountServiceTest {

	@Mock
	private UserRepository users;

	@Mock
	private UserTechTagRepository selectedTags;

	@Mock
	private FollowRepository follows;

	@Mock
	private UserBlockRepository blocks;

	@Mock
	private PublicProfileQuery profileQuery;

	@Mock
	private UsernameRedirectRepository redirects;

	@Mock
	private RecruiterProfileRepository recruiterProfiles;

	@Mock
	private ContributionDayRepository contributionDays;

	@Mock
	private ProfileVisitRecorder visits;

	@Mock
	private GithubTokenRepository githubTokens;

	@Mock
	private GithubTokenCipher githubCipher;

	@Mock
	private GithubUserAuthClient githubUsers;

	@Mock
	private Clock clock;

	@Mock
	private PlatformTransactionManager transactions;

	@InjectMocks
	private PublicAccountService profiles;

	@BeforeEach
	void emptyProfileExtras() {
		lenient().when(profileQuery.completion(anyLong())).thenReturn(new PublicProfileResponse.Completion(0, 0));
		lenient().when(profileQuery.teams(anyLong())).thenReturn(List.of());
	}

	@Test
	void guestSeesOffersOnlyAsOffAndAnEmptyCompletionRecord() {
		User user = developer();
		ReflectionTestUtils.setField(user, "jobSeekingStatus", JobSeekingStatus.OFFERS_ONLY);
		ReflectionTestUtils.setField(user, "lookingForTeam", true);
		when(users.findByUsername("octocat")).thenReturn(Optional.of(user));
		when(selectedTags.findSelected(7L)).thenReturn(List.of());
		when(follows.countByFollowing_Id(7L)).thenReturn(2L);
		when(follows.countByFollower_Id(7L)).thenReturn(1L);

		var profile = profiles.profile("octocat", null);

		assertThat(profile.jobStatus()).isEqualTo("OFF");
		assertThat(profile.lookingForTeam()).isTrue();
		assertThat(profile.githubUrl()).isEqualTo("https://github.com/octocat");
		assertThat(profile.completion().projectCount()).isZero();
		assertThat(profile.isFollowing()).isFalse();
		assertThat(profile.isMe()).isFalse();
	}

	@Test
	void recruiterSeesOffersOnlyAsOpen() {
		User user = developer();
		ReflectionTestUtils.setField(user, "jobSeekingStatus", JobSeekingStatus.OFFERS_ONLY);
		when(users.findByUsername("octocat")).thenReturn(Optional.of(user));
		when(selectedTags.findSelected(7L)).thenReturn(List.of());

		var profile = profiles.profile("octocat", viewer(3L, UserType.RECRUITER));

		assertThat(profile.jobStatus()).isEqualTo("OPEN");
		verify(visits).recordDeveloperView(7L, 3L);
	}

	@Test
	void anOldLoginResolvesToTheCurrentUsername() {
		User user = developer();
		when(users.findByUsername("old-octo")).thenReturn(Optional.empty());
		when(redirects.findByOldUsername("old-octo"))
				.thenReturn(Optional.of(UsernameRedirect.keep(user, "old-octo", Instant.parse("2099-01-01T00:00:00Z"))));
		when(clock.instant()).thenReturn(Instant.parse("2026-11-06T00:00:00Z"));
		when(selectedTags.findSelected(7L)).thenReturn(List.of());
		when(follows.countByFollowing_Id(7L)).thenReturn(0L);
		when(follows.countByFollower_Id(7L)).thenReturn(0L);

		var profile = profiles.profile("old-octo", null);

		assertThat(profile.login()).isEqualTo("octocat");
		assertThat(profile.redirectedFrom()).isEqualTo("old-octo");
	}

	@Test
	void aBlockEitherWayHidesTheProfile() {
		User user = developer();
		when(users.findByUsername("octocat")).thenReturn(Optional.of(user));
		when(blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(3L, 7L)).thenReturn(true);

		assertThatThrownBy(() -> profiles.profile("octocat", viewer(3L, UserType.DEVELOPER)))
				.isInstanceOf(ApiException.class)
				.hasMessage("볼 수 없는 프로필");
		assertThatThrownBy(() -> profiles.teams("octocat", viewer(3L, UserType.DEVELOPER)))
				.isInstanceOf(ApiException.class)
				.hasMessage("볼 수 없는 프로필");
	}

	@Test
	void profileUsesCompletionRowsAndListsCurrentTeams() {
		User user = developer();
		when(users.findByUsername("octocat")).thenReturn(Optional.of(user));
		when(selectedTags.findSelected(7L)).thenReturn(List.of());
		when(follows.countByFollowing_Id(7L)).thenReturn(0L);
		when(follows.countByFollower_Id(7L)).thenReturn(0L);
		when(profileQuery.completion(7L)).thenReturn(new PublicProfileResponse.Completion(2, 0.5));
		when(profileQuery.teams(7L)).thenReturn(List.of(new PublicTeamsResponse.TeamItem(3L, "Linker", null, "ACTIVE")));

		var profile = profiles.profile("octocat", null);
		var teams = profiles.teams("octocat", null);

		assertThat(profile.completion().projectCount()).isEqualTo(2);
		assertThat(profile.completion().issueCompletionRate()).isEqualTo(0.5);
		assertThat(teams.items()).containsExactly(new PublicTeamsResponse.TeamItem(3L, "Linker", null, "ACTIVE"));
		assertThat(teams.nextCursor()).isNull();
	}

	private static User developer() {
		User user = User.create("octocat", UserType.DEVELOPER);
		ReflectionTestUtils.setField(user, "id", 7L);
		ReflectionTestUtils.setField(user, "displayName", "Octo");
		ReflectionTestUtils.setField(user, "createdAt", Instant.parse("2026-11-01T00:00:00Z"));
		return user;
	}

	private static AuthenticatedUser viewer(long id, UserType type) {
		return new AuthenticatedUser(id, "viewer", type, UserStatus.ACTIVE, null, false, false, true, 1L);
	}
}
