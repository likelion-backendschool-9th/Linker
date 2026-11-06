package com.linker.backend.service.admin;

import java.time.Instant;

import com.linker.backend.entity.chat.ChatMessage;
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

import org.springframework.stereotype.Component;

/**
 * Applies an operator hide, delete, or restore to the reported row.
 */
@Component
public class ReportContentEffects {

	private final ChatMessageRepository messages;
	private final PostRepository posts;
	private final CommentRepository comments;
	private final RecruitPostRepository recruitPosts;
	private final RecruiterAdRepository ads;

	public ReportContentEffects(
			ChatMessageRepository messages,
			PostRepository posts,
			CommentRepository comments,
			RecruitPostRepository recruitPosts,
			RecruiterAdRepository ads) {
		this.messages = messages;
		this.posts = posts;
		this.comments = comments;
		this.recruitPosts = recruitPosts;
		this.ads = ads;
	}

	public void apply(ReportTargetType type, long targetId, AdminActionType action, Instant now) {
		if (action == AdminActionType.DISMISS || type == ReportTargetType.USER) {
			return;
		}
		switch (type) {
			case TEAM_MESSAGE, DM_MESSAGE -> chat(targetId, action, now);
			case POST -> post(targetId, action, now);
			case COMMENT -> comment(targetId, action, now);
			case RECRUIT_POST -> recruitPost(targetId, action, now);
			case RECRUITER_AD -> ad(targetId, action, now);
			case USER -> {
			}
		}
	}

	private void chat(long targetId, AdminActionType action, Instant now) {
		ChatMessage message = messages.lockById(targetId)
				.orElseThrow(this::missing);
		switch (action) {
			case HIDE -> message.hide();
			case DELETE -> {
				message.hide();
				message.delete(now);
			}
			case RESTORE -> message.restore();
			default -> {
			}
		}
	}

	private void post(long targetId, AdminActionType action, Instant now) {
		if (posts.updateReportedVisibility(targetId, postVisibility(action), deletedAt(action, now)) == 0) {
			throw missing();
		}
	}

	private void comment(long targetId, AdminActionType action, Instant now) {
		if (comments.updateReportedVisibility(targetId, postVisibility(action), deletedAt(action, now)) == 0) {
			throw missing();
		}
	}

	private void recruitPost(long targetId, AdminActionType action, Instant now) {
		if (recruitPosts.updateReportedVisibility(targetId, recruitVisibility(action), deletedAt(action, now)) == 0) {
			throw missing();
		}
	}

	private void ad(long targetId, AdminActionType action, Instant now) {
		AdStatus status = action == AdminActionType.RESTORE ? AdStatus.ACTIVE : AdStatus.HIDDEN;
		Instant hiddenAt = action == AdminActionType.RESTORE ? null : now;
		if (ads.updateReportedState(targetId, status, hiddenAt, deletedAt(action, now)) == 0) {
			throw missing();
		}
	}

	private static PostVisibility postVisibility(AdminActionType action) {
		return action == AdminActionType.RESTORE ? PostVisibility.VISIBLE : PostVisibility.HIDDEN;
	}

	private static RecruitVisibility recruitVisibility(AdminActionType action) {
		return action == AdminActionType.RESTORE ? RecruitVisibility.VISIBLE : RecruitVisibility.HIDDEN;
	}

	private static Instant deletedAt(AdminActionType action, Instant now) {
		return action == AdminActionType.DELETE ? now : null;
	}

	private ApiException missing() {
		return new ApiException(404, "NOT_FOUND", "신고 대상을 찾을 수 없어요");
	}
}
