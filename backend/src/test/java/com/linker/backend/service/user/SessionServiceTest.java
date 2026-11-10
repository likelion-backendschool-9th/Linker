package com.linker.backend.service.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import com.linker.backend.dto.auth.response.MeResponse;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserSession;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.account.UserSessionRepository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SessionServiceTest {

	private static final Instant NOW = Instant.parse("2026-11-05T10:00:00Z");

	@Mock
	private UserSessionRepository sessions;

	@Mock
	private UserRepository users;

	@Test
	void meReturnsTheStoredGithubAvatarNotOneBuiltFromTheLinkerUserId() {
		User user = User.create("octocat", UserType.DEVELOPER);
		user.refreshAvatar("https://avatars.githubusercontent.com/u/583231?v=4");
		when(users.findById(1L)).thenReturn(Optional.of(user));

		MeResponse me = service().me(principal(1L));

		assertThat(me.avatarUrl()).isEqualTo("https://avatars.githubusercontent.com/u/583231?v=4");
	}

	@Test
	void meReturnsNullAvatarWhenTheAccountHasNoPhoto() {
		when(users.findById(1L)).thenReturn(Optional.of(User.create("octocat", UserType.DEVELOPER)));

		assertThat(service().me(principal(1L)).avatarUrl()).isNull();
	}

	@Test
	void logoutRevokesTheCurrentSession() {
		User user = User.create("octocat", UserType.DEVELOPER);
		UserSession session = UserSession.issue(user, "hash", "JUnit", "127.0.0.1", NOW.plusSeconds(3600));
		when(sessions.findById(9L)).thenReturn(Optional.of(session));
		service().logout(principal(7L));

		assertThat(session.getRevokedAt()).isEqualTo(NOW);
	}

	private static AuthenticatedUser principal(long userId) {
		return new AuthenticatedUser(
				userId, "octocat", UserType.DEVELOPER, UserStatus.ACTIVE, null, false, false, false, 9L);
	}

	private SessionService service() {
		return new SessionService(sessions, users, mock(AccountService.class), Clock.fixed(NOW, ZoneOffset.UTC));
	}
}
