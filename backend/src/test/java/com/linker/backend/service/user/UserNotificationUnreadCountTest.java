package com.linker.backend.service.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.notification.NotificationRepository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UserNotificationUnreadCountTest {

	private static final Instant NOW = Instant.parse("2026-11-05T10:00:00Z");

	@Mock
	private UserRepository users;

	@Mock
	private NotificationRepository notifications;

	@Test
	void unreadCountUsesVisibleRowsOnly() {
		when(notifications.countVisibleUnread(7L, NOW)).thenReturn(2L);
		AuthenticatedUser principal = new AuthenticatedUser(
				7L, "octocat", UserType.DEVELOPER, UserStatus.ACTIVE, null, false, false, false, 9L);

		long count = new UserNotificationService(users, notifications, Clock.fixed(NOW, ZoneOffset.UTC), null, null, null)
				.unreadCount(principal);

		assertThat(count).isEqualTo(2L);
	}

	@Test
	void pushSwitchChangesOnlyTheUserFlag() {
		User user = User.create("octocat", UserType.DEVELOPER);
		when(users.findById(7L)).thenReturn(Optional.of(user));
		AuthenticatedUser principal = new AuthenticatedUser(
				7L, "octocat", UserType.DEVELOPER, UserStatus.ACTIVE, null, false, false, false, 9L);

		boolean saved = new UserNotificationService(users, notifications, Clock.fixed(NOW, ZoneOffset.UTC), null, null, null)
				.setPushEnabled(principal, false);

		assertThat(saved).isFalse();
		assertThat(user.isPushEnabled()).isFalse();
		verifyNoInteractions(notifications);
	}
}
