package com.linker.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.account.JobSeekingStatus;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.moderation.UserBlockRepository;
import com.linker.backend.repository.profile.FollowRepository;
import com.linker.backend.repository.profile.UserTechTagRepository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

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

	@InjectMocks
	private PublicAccountService profiles;

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
	}

	@Test
	void aBlockEitherWayHidesTheProfile() {
		User user = developer();
		when(users.findByUsername("octocat")).thenReturn(Optional.of(user));
		when(blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(3L, 7L)).thenReturn(true);

		assertThatThrownBy(() -> profiles.profile("octocat", viewer(3L, UserType.DEVELOPER)))
				.isInstanceOf(ApiException.class)
				.hasMessage("볼 수 없는 프로필");
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
