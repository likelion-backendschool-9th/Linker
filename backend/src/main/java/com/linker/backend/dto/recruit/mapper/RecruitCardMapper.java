package com.linker.backend.dto.recruit.mapper;

import java.util.List;

import com.linker.backend.dto.recruit.response.AuthorBriefResponse;
import com.linker.backend.dto.recruit.response.AuthorCardResponse;
import com.linker.backend.dto.recruit.response.RecruitCardResponse;
import com.linker.backend.dto.recruit.response.RecruitRoleResponse;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.recruit.RecruitPost;
import com.linker.backend.entity.recruit.RecruitRole;

import org.springframework.stereotype.Component;

@Component
public class RecruitCardMapper {

	public RecruitCardResponse toCard(RecruitPost post) {
		User author = post.getAuthor();
		List<RecruitRoleResponse> roles = post.getRoles().stream().map(this::toRole).toList();
		List<String> techTags = post.getTags().stream()
				.map(tag -> tag.getTag().getName())
				.toList();
		return new RecruitCardResponse(
				post.getId(),
				post.getTitle(),
				toAuthor(author),
				post.getWorkMode().name(),
				post.getRegion(),
				post.getGoal() == null ? null : post.getGoal().name(),
				post.getDeadline().toString(),
				post.getStatus().name(),
				techTags,
				roles,
				post.getCreatedAt().toString()
		);
	}

	public RecruitRoleResponse toRole(RecruitRole role) {
		return new RecruitRoleResponse(
				role.getId(),
				role.getRole().name(),
				role.getRole().label(),
				role.getHeadcount(),
				role.getAcceptedCount(),
				role.remaining()
		);
	}

	public AuthorBriefResponse toAuthor(User author) {
		return new AuthorBriefResponse(
				author.getId(),
				author.getUsername(),
				author.visibleName(),
				author.getAvatarUrl() == null ? "" : author.getAvatarUrl(),
				author.getUserType().name(),
				author.getJobSeekingStatus().name()
		);
	}

	public AuthorCardResponse toAuthorCard(User author) {
		AuthorBriefResponse brief = toAuthor(author);
		return new AuthorCardResponse(
				brief.id(),
				brief.login(),
				brief.name(),
				brief.avatarUrl(),
				brief.userType(),
				brief.jobStatus(),
				author.getBio()
		);
	}
}
