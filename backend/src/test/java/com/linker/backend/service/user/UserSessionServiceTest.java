package com.linker.backend.service.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserSession;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.account.UserSessionRepository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UserSessionServiceTest {

	private static final Instant NOW = Instant.parse("2026-11-05T10:00:00Z");

	@Mock
	private UserSessionRepository sessions;

	@Test
	void logoutRevokesTheCurrentSession() {
		User user = User.create("octocat", UserType.DEVELOPER);
		UserSession session = UserSession.issue(user, "hash", "JUnit", "127.0.0.1", NOW.plusSeconds(3600));
		when(sessions.findById(9L)).thenReturn(Optional.of(session));
		AuthenticatedUser principal = new AuthenticatedUser(
				7L, "octocat", UserType.DEVELOPER, UserStatus.ACTIVE, null, false, false, false, 9L);

		service().logout(principal);

		assertThat(session.getRevokedAt()).isEqualTo(NOW);
	}

	private UserSessionService service() {
		return new UserSessionService(sessions, mock(UserAccountService.class), Clock.fixed(NOW, ZoneOffset.UTC));
	}
}
