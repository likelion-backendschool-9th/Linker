package com.linker.backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;

import com.linker.backend.entity.chat.ChatMessage;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.DmStatus;
import com.linker.backend.entity.chat.MessageVisibility;
import com.linker.backend.entity.chat.RequestKind;
import com.linker.backend.entity.moderation.AdminActionType;
import com.linker.backend.entity.moderation.ReportTargetType;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.repository.chat.ChatMessageRepository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

@ExtendWith(MockitoExtension.class)
class ReportContentEffectsTest {

	private static final Instant NOW = Instant.parse("2026-11-06T02:00:00Z");

	@Mock
	private ChatMessageRepository messages;

	@Mock
	private JdbcTemplate jdbc;

	@Test
	void hideDeleteAndRestoreAChatMessage() {
		ChatMessage message = ChatMessage.text(
				ChatRoom.direct(1L, 2L, DmStatus.ACCEPTED, RequestKind.GENERAL, NOW),
				1L,
				"hello");
		when(messages.lockById(4L)).thenReturn(Optional.of(message));
		ReportContentEffects effects = new ReportContentEffects(messages, jdbc);

		effects.apply(ReportTargetType.TEAM_MESSAGE, 4L, AdminActionType.HIDE, NOW);
		assertThat(message.getVisibility()).isEqualTo(MessageVisibility.HIDDEN);
		assertThat(message.getDeletedAt()).isNull();

		effects.apply(ReportTargetType.DM_MESSAGE, 4L, AdminActionType.DELETE, NOW);
		assertThat(message.getVisibility()).isEqualTo(MessageVisibility.HIDDEN);
		assertThat(message.getDeletedAt()).isEqualTo(NOW);

		effects.apply(ReportTargetType.TEAM_MESSAGE, 4L, AdminActionType.RESTORE, NOW);
		assertThat(message.getVisibility()).isEqualTo(MessageVisibility.VISIBLE);
		assertThat(message.getDeletedAt()).isNull();

		effects.apply(ReportTargetType.USER, 8L, AdminActionType.HIDE, NOW);
		effects.apply(ReportTargetType.POST, 8L, AdminActionType.DISMISS, NOW);
	}

	@Test
	void aMissingMessageRejectsTheAction() {
		when(messages.lockById(4L)).thenReturn(Optional.empty());
		ReportContentEffects effects = new ReportContentEffects(messages, jdbc);

		assertThatThrownBy(() -> effects.apply(ReportTargetType.TEAM_MESSAGE, 4L, AdminActionType.HIDE, NOW))
				.isInstanceOf(ApiException.class)
				.hasMessage("신고 대상을 찾을 수 없어요");
	}
}
