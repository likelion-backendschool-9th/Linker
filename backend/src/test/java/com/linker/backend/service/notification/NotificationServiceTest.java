package com.linker.backend.service.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Optional;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.entity.notification.Notification;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.notification.NotificationRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

	@Mock
	UserRepository users;

	@Mock
	NotificationRepository notifications;

	NotificationService service;

	@BeforeEach
	void setUp() {
		Instant fixed = LocalDateTime.of(2026, 11, 3, 23, 0).atZone(PlanLimits.APP_ZONE).toInstant();
		Clock clock = Clock.fixed(fixed, PlanLimits.APP_ZONE);
		service = new NotificationService(users, notifications, clock);
	}

	@Test
	void createPersistsChatWithoutDeliverAfter() {
		User recipient = User.create("alice", UserType.DEVELOPER);
		when(users.findById(1L)).thenReturn(Optional.of(recipient));
		when(notifications.save(any(Notification.class))).thenAnswer(invocation -> invocation.getArgument(0));

		service.create(new CreateNotificationCommand(
				1L,
				NotificationTypes.CHAT,
				null,
				"CHAT_ROOM",
				10L,
				"/chats/10",
				null,
				"chat:10"
		));

		ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
		verify(notifications).save(captor.capture());
		Notification saved = captor.getValue();
		assertThat(saved.getNotificationType()).isEqualTo(NotificationTypes.CHAT);
		assertThat(saved.getGroupKey()).isEqualTo("chat:10");
		assertThat(saved.getDeliverAfter()).isNull();
		assertThat(saved.getLinkPath()).isEqualTo("/chats/10");
	}

	@Test
	void createDefersNonChatDuringQuietHours() {
		User recipient = User.create("alice", UserType.DEVELOPER);
		when(users.findById(1L)).thenReturn(Optional.of(recipient));
		when(notifications.save(any(Notification.class))).thenAnswer(invocation -> invocation.getArgument(0));

		service.create(new CreateNotificationCommand(
				1L,
				NotificationTypes.ISSUE_ASSIGNED,
				null,
				"ISSUE",
				99L,
				"/teams/1/issues/99",
				"{\"issueNumber\":99}",
				null
		));

		ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
		verify(notifications).save(captor.capture());
		Instant expected = LocalDateTime.of(2026, 11, 4, 8, 0).atZone(PlanLimits.APP_ZONE).toInstant();
		assertThat(captor.getValue().getDeliverAfter()).isEqualTo(expected);
		assertThat(captor.getValue().getPayload()).isEqualTo("{\"issueNumber\":99}");
	}

	@Test
	void createRejectsMissingRecipient() {
		when(users.findById(99L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.create(new CreateNotificationCommand(
				99L,
				NotificationTypes.FOLLOW,
				null,
				null,
				null,
				null,
				null,
				null
		)))
				.isInstanceOf(ApiException.class)
				.extracting(ex -> ((ApiException) ex).getCode())
				.isEqualTo("NOT_FOUND");
	}
}
