package com.linker.backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;

import com.linker.backend.dto.chat.event.ChatMessageModerated;
import com.linker.backend.entity.chat.ChatMessage;
import com.linker.backend.entity.chat.type.MessageVisibility;
import com.linker.backend.entity.moderation.type.AdminActionType;
import com.linker.backend.entity.moderation.type.ReportTargetType;
import com.linker.backend.repository.chat.ChatMessageRepository;
import com.linker.backend.repository.post.CommentRepository;
import com.linker.backend.repository.post.PostRepository;
import com.linker.backend.repository.profile.RecruiterAdRepository;
import com.linker.backend.repository.recruit.RecruitPostRepository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

@ExtendWith(MockitoExtension.class)
class ReportAutoHideUndoTest {

	private static final Instant NOW = Instant.parse("2026-11-07T02:00:00Z");

	@Mock
	private ChatMessageRepository messages;
	@Mock
	private PostRepository posts;
	@Mock
	private CommentRepository comments;
	@Mock
	private RecruitPostRepository recruitPosts;
	@Mock
	private RecruiterAdRepository ads;
	@Mock
	private ApplicationEventPublisher events;

	@Test
	void undoAutoHideShowsTheMessageButKeepsItsDeletionAndBroadcasts() {
		ChatMessage message = ReportContentEffectsTest.message(4L);
		message.hide();
		message.delete(NOW);
		when(messages.lockById(4L)).thenReturn(Optional.of(message));

		effects().undoAutoHide(ReportTargetType.TEAM_MESSAGE, 4L);

		assertThat(message.getVisibility()).isEqualTo(MessageVisibility.VISIBLE);
		assertThat(message.getDeletedAt()).isEqualTo(NOW);
		verify(events).publishEvent(new ChatMessageModerated(30L, 4L));
	}

	@Test
	void undoAutoHideIgnoresTargetsThatAreNotAutoHiddenYet() {
		ReportContentEffects effects = effects();

		effects.undoAutoHide(ReportTargetType.USER, 8L);
		effects.undoAutoHide(ReportTargetType.POST, 8L);

		verifyNoInteractions(messages, posts, comments, recruitPosts, ads, events);
	}

	@Test
	void operatorChatActionsBroadcastTheChangedMessage() {
		when(messages.lockById(4L)).thenReturn(Optional.of(ReportContentEffectsTest.message(4L)));

		effects().apply(ReportTargetType.DM_MESSAGE, 4L, AdminActionType.HIDE, NOW);

		verify(events).publishEvent(new ChatMessageModerated(30L, 4L));
	}

	private ReportContentEffects effects() {
		return new ReportContentEffects(messages, posts, comments, recruitPosts, ads, events);
	}
}
