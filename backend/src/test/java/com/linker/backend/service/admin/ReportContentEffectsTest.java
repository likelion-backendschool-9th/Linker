package com.linker.backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;

import com.linker.backend.entity.chat.ChatMessage;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.type.DmStatus;
import com.linker.backend.entity.chat.type.MessageVisibility;
import com.linker.backend.entity.chat.type.RequestKind;
import com.linker.backend.entity.moderation.type.AdminActionType;
import com.linker.backend.entity.moderation.type.ReportTargetType;
import com.linker.backend.entity.post.type.PostVisibility;
import com.linker.backend.entity.profile.type.AdStatus;
import com.linker.backend.entity.recruit.type.RecruitVisibility;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.repository.chat.ChatMessageRepository;
import com.linker.backend.repository.post.CommentRepository;
import com.linker.backend.repository.post.PostRepository;
import com.linker.backend.repository.profile.RecruiterAdRepository;
import com.linker.backend.repository.recruit.RecruitPostRepository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ReportContentEffectsTest {

	private static final Instant NOW = Instant.parse("2026-11-06T02:00:00Z");

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
	private org.springframework.context.ApplicationEventPublisher events;

	@Test
	void hideDeleteAndRestoreAChatMessage() {
		ChatMessage message = message(4L);
		when(messages.lockById(4L)).thenReturn(Optional.of(message));
		ReportContentEffects effects = effects();

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
		verifyNoInteractions(posts, comments, recruitPosts, ads);
	}

	@Test
	void aMissingMessageRejectsTheAction() {
		when(messages.lockById(4L)).thenReturn(Optional.empty());
		ReportContentEffects effects = effects();

		assertThatThrownBy(() -> effects.apply(ReportTargetType.TEAM_MESSAGE, 4L, AdminActionType.HIDE, NOW))
				.isInstanceOf(ApiException.class)
				.hasMessage("신고 대상을 찾을 수 없어요");
	}

	@Test
	void hideDeleteAndRestoreAPostCommentAndRecruitPost() {
		when(posts.updateReportedVisibility(8L, PostVisibility.HIDDEN, null)).thenReturn(1);
		when(posts.updateReportedVisibility(8L, PostVisibility.VISIBLE, null)).thenReturn(1);
		when(posts.updateReportedVisibility(8L, PostVisibility.HIDDEN, NOW)).thenReturn(1);
		when(comments.updateReportedVisibility(9L, PostVisibility.HIDDEN, null)).thenReturn(1);
		when(recruitPosts.updateReportedVisibility(10L, RecruitVisibility.HIDDEN, null)).thenReturn(1);
		when(recruitPosts.updateReportedVisibility(10L, RecruitVisibility.VISIBLE, null)).thenReturn(1);
		when(recruitPosts.updateReportedVisibility(10L, RecruitVisibility.HIDDEN, NOW)).thenReturn(1);
		ReportContentEffects effects = effects();

		effects.apply(ReportTargetType.POST, 8L, AdminActionType.HIDE, NOW);
		effects.apply(ReportTargetType.POST, 8L, AdminActionType.RESTORE, NOW);
		effects.apply(ReportTargetType.POST, 8L, AdminActionType.DELETE, NOW);
		effects.apply(ReportTargetType.COMMENT, 9L, AdminActionType.HIDE, NOW);
		effects.apply(ReportTargetType.RECRUIT_POST, 10L, AdminActionType.HIDE, NOW);
		effects.apply(ReportTargetType.RECRUIT_POST, 10L, AdminActionType.RESTORE, NOW);
		effects.apply(ReportTargetType.RECRUIT_POST, 10L, AdminActionType.DELETE, NOW);

		verify(posts).updateReportedVisibility(8L, PostVisibility.HIDDEN, null);
		verify(posts).updateReportedVisibility(8L, PostVisibility.VISIBLE, null);
		verify(posts).updateReportedVisibility(8L, PostVisibility.HIDDEN, NOW);
		verify(comments).updateReportedVisibility(9L, PostVisibility.HIDDEN, null);
		verify(recruitPosts).updateReportedVisibility(10L, RecruitVisibility.HIDDEN, null);
		verify(recruitPosts).updateReportedVisibility(10L, RecruitVisibility.VISIBLE, null);
		verify(recruitPosts).updateReportedVisibility(10L, RecruitVisibility.HIDDEN, NOW);
	}

	@Test
	void aMissingPostCommentOrRecruitPostRejectsTheAction() {
		when(posts.updateReportedVisibility(8L, PostVisibility.HIDDEN, null)).thenReturn(0);
		when(comments.updateReportedVisibility(9L, PostVisibility.HIDDEN, null)).thenReturn(0);
		when(recruitPosts.updateReportedVisibility(10L, RecruitVisibility.HIDDEN, NOW)).thenReturn(0);
		ReportContentEffects effects = effects();

		assertThatThrownBy(() -> effects.apply(ReportTargetType.POST, 8L, AdminActionType.HIDE, NOW))
				.isInstanceOf(ApiException.class)
				.hasMessage("신고 대상을 찾을 수 없어요");
		assertThatThrownBy(() -> effects.apply(ReportTargetType.COMMENT, 9L, AdminActionType.HIDE, NOW))
				.isInstanceOf(ApiException.class)
				.hasMessage("신고 대상을 찾을 수 없어요");
		assertThatThrownBy(() -> effects.apply(ReportTargetType.RECRUIT_POST, 10L, AdminActionType.DELETE, NOW))
				.isInstanceOf(ApiException.class)
				.hasMessage("신고 대상을 찾을 수 없어요");
	}

	@Test
	void hideDeleteAndRestoreARecruiterAd() {
		when(ads.updateReportedState(3L, AdStatus.HIDDEN, NOW, null)).thenReturn(1);
		when(ads.updateReportedState(3L, AdStatus.ACTIVE, null, null)).thenReturn(1);
		when(ads.updateReportedState(3L, AdStatus.HIDDEN, NOW, NOW)).thenReturn(1);
		ReportContentEffects effects = effects();

		effects.apply(ReportTargetType.RECRUITER_AD, 3L, AdminActionType.HIDE, NOW);
		effects.apply(ReportTargetType.RECRUITER_AD, 3L, AdminActionType.RESTORE, NOW);
		effects.apply(ReportTargetType.RECRUITER_AD, 3L, AdminActionType.DELETE, NOW);

		verify(ads).updateReportedState(3L, AdStatus.HIDDEN, NOW, null);
		verify(ads).updateReportedState(3L, AdStatus.ACTIVE, null, null);
		verify(ads).updateReportedState(3L, AdStatus.HIDDEN, NOW, NOW);
	}

	@Test
	void aMissingRecruiterAdRejectsTheAction() {
		when(ads.updateReportedState(3L, AdStatus.HIDDEN, NOW, null)).thenReturn(0);

		assertThatThrownBy(() -> effects().apply(ReportTargetType.RECRUITER_AD, 3L, AdminActionType.HIDE, NOW))
				.isInstanceOf(ApiException.class)
				.hasMessage("신고 대상을 찾을 수 없어요");
	}

	static ChatMessage message(long id) {
		ChatRoom room = ChatRoom.direct(1L, 2L, DmStatus.ACCEPTED, RequestKind.GENERAL, NOW);
		ReflectionTestUtils.setField(room, "id", 30L);
		ChatMessage message = ChatMessage.text(room, 1L, "hello");
		ReflectionTestUtils.setField(message, "id", id);
		return message;
	}

	private ReportContentEffects effects() {
		return new ReportContentEffects(messages, posts, comments, recruitPosts, ads, events);
	}
}
