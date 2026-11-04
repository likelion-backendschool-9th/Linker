package com.linker.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Stream;

import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.entity.notification.Notification;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.notification.NotificationRepository;
import com.linker.backend.service.admin.AdminNotificationService;
import com.linker.backend.service.recruiter.RecruiterNotificationService;
import com.linker.backend.service.user.UserNotificationService;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;

class RoleNotificationServiceTest {

	enum Role { USER, RECRUITER, ADMIN }

	private final UserRepository users = mock(UserRepository.class);
	private final NotificationRepository notifications = mock(NotificationRepository.class);

	private Function<CreateNotificationCommand, Notification> creator(Role role, String time) {
		Clock clock = Clock.fixed(kst(time), PlanLimits.APP_ZONE);
		return switch (role) {
			case USER -> new UserNotificationService(users, notifications, clock)::create;
			case RECRUITER -> new RecruiterNotificationService(users, notifications, clock)::create;
			case ADMIN -> new AdminNotificationService(users, notifications, clock)::create;
		};
	}

	@ParameterizedTest
	@EnumSource(Role.class)
	void preservesActorPayloadTargetAndUnreadStateForEitherAccountType(Role role) {
		User recipient = User.create("recipient", UserType.RECRUITER);
		User actor = User.create("actor", UserType.DEVELOPER);
		when(users.findById(1L)).thenReturn(Optional.of(recipient));
		when(users.findById(2L)).thenReturn(Optional.of(actor));
		when(notifications.save(any(Notification.class))).thenAnswer(i -> i.getArgument(0));

		Notification saved = creator(role, "2026-11-04T12:00").apply(new CreateNotificationCommand(
				1L, " TEAM_INVITE ", 2L, " TEAM ", 3L, " /invite/abc ", "{\"name\":\"팀\"}", " invite:abc "));

		assertThat(saved.getUser()).isSameAs(recipient);
		assertThat(saved.getActor()).isSameAs(actor);
		assertThat(saved.getNotificationType()).isEqualTo("TEAM_INVITE");
		assertThat(saved.getTargetType()).isEqualTo("TEAM");
		assertThat(saved.getTargetId()).isEqualTo(3L);
		assertThat(saved.getLinkPath()).isEqualTo("/invite/abc");
		assertThat(saved.getPayload()).isEqualTo("{\"name\":\"팀\"}");
		assertThat(saved.getGroupKey()).isEqualTo("invite:abc");
		assertThat(saved.getReadAt()).isNull();
		assertThat(saved.getPushedAt()).isNull();
		verify(notifications).save(saved);
	}

	@ParameterizedTest
	@MethodSource("quietHours")
	void appliesPolicyAtKstBoundariesForEveryRole(Role role, String type, String now, String expected) {
		when(users.findById(1L)).thenReturn(Optional.of(User.create("recipient", UserType.DEVELOPER)));
		when(notifications.save(any(Notification.class))).thenAnswer(i -> i.getArgument(0));
		Notification saved = creator(role, now).apply(command(1L, type, null));
		assertThat(saved.getDeliverAfter()).isEqualTo(expected == null ? null : kst(expected));
		assertThat(saved.getActor()).isNull();
	}

	static Stream<Arguments> quietHours() {
		String[][] cases = {
				{"FOLLOW", "2026-11-04T21:59:59", null},
				{"FOLLOW", "2026-11-04T22:00", "2026-11-05T08:00"},
				{"FOLLOW", "2026-11-04T07:59:59", "2026-11-04T08:00"},
				{"FOLLOW", "2026-11-04T08:00", null},
				{"MARKETING", "2026-11-04T20:59:59", null},
				{"MARKETING", "2026-11-04T21:00", "2026-11-05T08:00"},
				{"MARKETING", "2026-11-04T08:00", null},
				{"CHAT", "2026-11-04T23:00", null},
				{"CHAT", "2026-11-04T02:00", null},
				{"FOLLOW", "2026-12-31T23:59", "2027-01-01T08:00"}
		};
		return Stream.of(Role.values()).flatMap(role -> Stream.of(cases)
				.map(c -> Arguments.of(role, c[0], c[1], c[2])));
	}

	@ParameterizedTest
	@EnumSource(Role.class)
	void missingRecipientDoesNotWriteNotification(Role role) {
		when(users.findById(99L)).thenReturn(Optional.empty());
		assertNotFound(() -> creator(role, "2026-11-04T12:00").apply(command(99L, "FOLLOW", null)));
		verifyNoInteractions(notifications);
	}

	@ParameterizedTest
	@EnumSource(Role.class)
	void deletedRecipientDoesNotWriteNotification(Role role) {
		User deleted = User.create("deleted", UserType.DEVELOPER);
		deleted.markDeleted(Instant.parse("2026-11-03T00:00:00Z"));
		when(users.findById(1L)).thenReturn(Optional.of(deleted));
		assertNotFound(() -> creator(role, "2026-11-04T12:00").apply(command(1L, "FOLLOW", null)));
		verifyNoInteractions(notifications);
	}

	@ParameterizedTest
	@EnumSource(Role.class)
	void missingActorDoesNotWriteNotification(Role role) {
		when(users.findById(1L)).thenReturn(Optional.of(User.create("recipient", UserType.DEVELOPER)));
		when(users.findById(99L)).thenReturn(Optional.empty());
		assertNotFound(() -> creator(role, "2026-11-04T12:00").apply(command(1L, "FOLLOW", 99L)));
		verifyNoInteractions(notifications);
	}

	private static void assertNotFound(Runnable action) {
		assertThatThrownBy(action::run).isInstanceOf(ApiException.class)
				.extracting(e -> ((ApiException) e).getCode()).isEqualTo("NOT_FOUND");
	}

	private static CreateNotificationCommand command(long userId, String type, Long actorId) {
		return new CreateNotificationCommand(userId, type, actorId, null, null, null, null, null);
	}

	private static Instant kst(String time) {
		return LocalDateTime.parse(time).atZone(PlanLimits.APP_ZONE).toInstant();
	}
}
