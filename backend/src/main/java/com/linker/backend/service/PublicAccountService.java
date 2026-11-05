package com.linker.backend.service;

import java.util.List;

import com.linker.backend.dto.account.response.PublicProfileResponse;
import com.linker.backend.entity.account.JobSeekingStatus;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.entity.profile.UserTechTag;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.moderation.UserBlockRepository;
import com.linker.backend.repository.profile.FollowRepository;
import com.linker.backend.repository.profile.UserTechTagRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Paired entry for {@link com.linker.backend.controller.PublicAccountController}. */
@Service
public class PublicAccountService {

	private final UserRepository users;
	private final UserTechTagRepository selectedTags;
	private final FollowRepository follows;
	private final UserBlockRepository blocks;

	public PublicAccountService(
			UserRepository users,
			UserTechTagRepository selectedTags,
			FollowRepository follows,
			UserBlockRepository blocks) {
		this.users = users;
		this.selectedTags = selectedTags;
		this.follows = follows;
		this.blocks = blocks;
	}

	@Transactional(readOnly = true)
	public PublicProfileResponse profile(String login, AuthenticatedUser viewer) {
		User user = visible(login);
		if (viewer != null && viewer.userId() != user.getId() && blockedEitherWay(viewer.userId(), user.getId())) {
			throw new ApiException(404, "NOT_FOUND", "볼 수 없는 프로필");
		}
		boolean self = viewer != null && viewer.userId() == user.getId();
		List<String> techStack = selectedTags.findSelected(user.getId()).stream().map(UserTechTag::tagName).toList();
		return new PublicProfileResponse(
				user.getId(),
				user.getUsername(),
				user.visibleName(),
				user.getAvatarUrl(),
				"https://github.com/" + user.getUsername(),
				user.getUserType().name(),
				user.getUserType().name(),
				user.getBio(),
				user.getBlogUrl(),
				techStack,
				user.isLookingForTeam(),
				jobStatus(user, viewer),
				follows.countByFollowing_Id(user.getId()),
				follows.countByFollower_Id(user.getId()),
				new PublicProfileResponse.Completion(0, 0),
				user.getCreatedAt(),
				self,
				viewer != null && follows.existsByFollower_IdAndFollowing_Id(viewer.userId(), user.getId()),
				false,
				null,
				null,
				null,
				null,
				null,
				List.of());
	}

	private User visible(String login) {
		if (login == null || login.isBlank()) {
			throw new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요");
		}
		return users.findByUsername(login.trim())
				.filter(user -> user.getStatus() != UserStatus.DELETED && user.getDeletedAt() == null)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));
	}

	private boolean blockedEitherWay(long firstUserId, long secondUserId) {
		return blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(firstUserId, secondUserId)
				|| blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(secondUserId, firstUserId);
	}

	static String jobStatus(User user, AuthenticatedUser viewer) {
		if (user.getJobSeekingStatus() != JobSeekingStatus.OFFERS_ONLY) {
			return user.getJobSeekingStatus() == JobSeekingStatus.OPEN ? "SEEKING" : "OFF";
		}
		boolean self = viewer != null && viewer.userId() == user.getId();
		boolean recruiter = viewer != null && viewer.userType() == UserType.RECRUITER;
		return self || recruiter ? "OPEN" : "OFF";
	}
}
