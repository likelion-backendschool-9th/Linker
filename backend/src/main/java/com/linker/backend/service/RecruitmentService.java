package com.linker.backend.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.linker.backend.dto.recruit.mapper.RecruitCardMapper;
import com.linker.backend.dto.recruit.response.CursorPage;
import com.linker.backend.dto.recruit.response.MyApplicationBriefResponse;
import com.linker.backend.dto.recruit.response.RecruitCardResponse;
import com.linker.backend.dto.recruit.response.RecruitDetailResponse;
import com.linker.backend.dto.recruit.response.RecruitTeamMemberResponse;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.recruit.Application;
import com.linker.backend.entity.recruit.RecruitPost;
import com.linker.backend.entity.recruit.type.ApplicationStatus;
import com.linker.backend.entity.recruit.type.RecruitRoleType;
import com.linker.backend.entity.recruit.type.RecruitStatus;
import com.linker.backend.entity.recruit.type.RecruitVisibility;
import com.linker.backend.entity.recruit.type.WorkMode;
import com.linker.backend.entity.team.Team;
import com.linker.backend.entity.team.TeamMember;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.CurrentUser;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.chat.ChatRoomRepository;
import com.linker.backend.repository.moderation.UserBlockRepository;
import com.linker.backend.repository.recruit.ApplicationRepository;
import com.linker.backend.repository.recruit.RecruitPostRepository;
import com.linker.backend.repository.team.TeamMemberRepository;
import com.linker.backend.repository.team.TeamRepository;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RecruitmentService {

	private final RecruitPostRepository posts;
	private final ApplicationRepository applications;
	private final UserBlockRepository blocks;
	private final RecruitCardMapper cards;
	private final TeamMemberRepository teamMembers;
	private final TeamRepository teams;
	private final ChatRoomRepository chatRooms;
	private final UserRepository users;

	public RecruitmentService(
			RecruitPostRepository posts,
			ApplicationRepository applications,
			UserBlockRepository blocks,
			RecruitCardMapper cards,
			TeamMemberRepository teamMembers,
			TeamRepository teams,
			ChatRoomRepository chatRooms,
			UserRepository users
	) {
		this.posts = posts;
		this.applications = applications;
		this.blocks = blocks;
		this.cards = cards;
		this.teamMembers = teamMembers;
		this.teams = teams;
		this.chatRooms = chatRooms;
		this.users = users;
	}

	@Transactional(readOnly = true)
	public CursorPage<RecruitCardResponse> listOpen(
			String q, String role, String tech, String mode, String sort, String cursor) {
		String titlePattern = titleSearchPattern(q);
		RecruitRoleType roleType = parseRole(role);
		WorkMode workMode = parseMode(mode);
		String normalizedTech = blankToNull(tech);
		String normalizedSort = sort == null || sort.isBlank() ? "NEWEST" : sort.trim().toUpperCase(Locale.ROOT);
		if (!normalizedSort.equals("NEWEST") && !normalizedSort.equals("DEADLINE")) {
			throw new ApiException(400, "VALIDATION_ERROR", "정렬을 확인해 주세요");
		}

		Set<Long> excluded = excludedAuthorIds(CurrentUser.optional().orElse(null));
		boolean excludeEmpty = excluded.isEmpty();
		List<Long> excludedIds = excludeEmpty ? List.of(-1L) : List.copyOf(excluded);
		int offset = parseOffset(cursor);

		List<RecruitPost> rows = loadOpen(normalizedSort, titlePattern, roleType, workMode, normalizedTech, excludeEmpty, excludedIds);
		int from = Math.min(offset, rows.size());
		int to = Math.min(from + PlanLimits.RECRUIT_PAGE_SIZE, rows.size());
		List<RecruitCardResponse> items = rows.subList(from, to).stream().map(cards::toCard).toList();
		String next = to < rows.size() ? Integer.toString(to) : null;
		return new CursorPage<>(items, next);
	}

	@Transactional(readOnly = true)
	public RecruitDetailResponse detail(long recruitId) {
		RecruitPost post = posts.findDetailedById(recruitId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "삭제되었거나 볼 수 없는 콘텐츠예요"));
		AuthenticatedUser viewer = CurrentUser.optional().orElse(null);
		boolean isAuthor = viewer != null && post.getAuthor().getId() == viewer.userId();
		if (post.getVisibility() != RecruitVisibility.VISIBLE && !isAuthor) {
			throw new ApiException(404, "NOT_FOUND", "삭제되었거나 볼 수 없는 콘텐츠예요");
		}
		if (viewer != null && !isAuthor) {
			long authorId = post.getAuthor().getId();
			if (blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(viewer.userId(), authorId)
					|| blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(authorId, viewer.userId())) {
				throw new ApiException(404, "NOT_FOUND", "삭제되었거나 볼 수 없는 콘텐츠예요");
			}
		}
		post.getTags().size();
		RecruitCardResponse card = cards.toCard(post);

		Long teamId = post.getTeamId();
		String teamName = null;
		List<RecruitTeamMemberResponse> roster = List.of();
		boolean isTeamMember = false;
		Long teamChatRoomId = null;
		if (teamId != null) {
			Team team = teams.findById(teamId).orElse(null);
			if (team != null) {
				teamName = team.getName();
			}
			roster = loadTeamMembers(teamId, post.getAuthor().getId());
			if (viewer != null) {
				isTeamMember = teamMembers.findByTeamIdAndUserIdAndLeftAtIsNull(teamId, viewer.userId()).isPresent();
			}
			teamChatRoomId = chatRooms.findTeamRoom(teamId).map(ChatRoom::getId).orElse(null);
		}
		if (roster.isEmpty()) {
			User author = post.getAuthor();
			roster = List.of(new RecruitTeamMemberResponse(
					author.getId(),
					author.getUsername(),
					author.visibleName(),
					author.getAvatarUrl() == null ? "" : author.getAvatarUrl(),
					"OWNER",
					true
			));
		}

		MyApplicationBriefResponse myApplication = null;
		if (viewer != null) {
			List<Application> mine = applications.findByRecruitPostIdAndApplicantId(post.getId(), viewer.userId());
			Application active = mine.stream()
					.filter(application -> application.getStatus() != ApplicationStatus.CANCELED)
					.findFirst()
					.orElse(null);
			if (active != null) {
				Long chatId = active.getStatus() == ApplicationStatus.ACCEPTED ? teamChatRoomId : null;
				myApplication = new MyApplicationBriefResponse(
						active.getId(),
						active.getStatus().name(),
						active.getRecruitRole().getId(),
						chatId
				);
			}
		}
		int applicantCount = (int) applications.countByRecruitPostIdAndStatus(
				post.getId(), ApplicationStatus.PENDING);
		return new RecruitDetailResponse(
				card.id(),
				card.title(),
				card.author(),
				card.format(),
				card.region(),
				card.goal(),
				card.deadline(),
				card.status(),
				card.techTags(),
				card.roles(),
				card.createdAt(),
				post.getDescription(),
				post.getExpectedPeriod(),
				teamName,
				cards.toAuthorCard(post.getAuthor()),
				roster,
				isAuthor,
				isTeamMember,
				myApplication,
				applicantCount
		);
	}

	private List<RecruitTeamMemberResponse> loadTeamMembers(long teamId, long authorId) {
		List<TeamMember> members = teamMembers.findByTeamIdAndLeftAtIsNullOrderByJoinedAtAscIdAsc(teamId);
		if (members.isEmpty()) {
			return List.of();
		}
		Set<Long> userIds = members.stream().map(TeamMember::getUserId).collect(Collectors.toSet());
		Map<Long, User> byId = users.findAllById(userIds).stream()
				.collect(Collectors.toMap(User::getId, Function.identity()));
		List<RecruitTeamMemberResponse> items = new ArrayList<>();
		for (TeamMember member : members) {
			User account = byId.get(member.getUserId());
			if (account == null || account.getDeletedAt() != null) {
				continue;
			}
			items.add(new RecruitTeamMemberResponse(
					account.getId(),
					account.getUsername(),
					account.visibleName(),
					account.getAvatarUrl() == null ? "" : account.getAvatarUrl(),
					member.getRole().name(),
					account.getId() == authorId
			));
		}
		return items;
	}

	private List<RecruitPost> loadOpen(
			String sort,
			String titlePattern,
			RecruitRoleType role,
			WorkMode mode,
			String tech,
			boolean excludeEmpty,
			List<Long> excludedIds
	) {
		PageRequest all = PageRequest.of(0, 500);
		if ("DEADLINE".equals(sort)) {
			return posts.findOpenByDeadline(
					RecruitStatus.OPEN,
					RecruitVisibility.VISIBLE,
					titlePattern,
					role,
					mode,
					tech,
					excludeEmpty,
					excludedIds,
					all
			);
		}
		return posts.findOpenNewest(
				RecruitStatus.OPEN,
				RecruitVisibility.VISIBLE,
				titlePattern,
				role,
				mode,
				tech,
				excludeEmpty,
				excludedIds,
				all
		);
	}

	private Set<Long> excludedAuthorIds(AuthenticatedUser viewer) {
		if (viewer == null) {
			return Set.of();
		}
		Set<Long> excluded = new HashSet<>();
		excluded.addAll(blocks.findActiveBlockedIds(viewer.userId()));
		excluded.addAll(blocks.findActiveBlockerIds(viewer.userId()));
		return excluded;
	}

	private static int parseOffset(String cursor) {
		if (cursor == null || cursor.isBlank()) {
			return 0;
		}
		try {
			int offset = Integer.parseInt(cursor.trim());
			if (offset < 0) {
				throw new ApiException(400, "VALIDATION_ERROR", "커서를 확인해 주세요");
			}
			return offset;
		}
		catch (NumberFormatException ex) {
			throw new ApiException(400, "VALIDATION_ERROR", "커서를 확인해 주세요");
		}
	}

	/**
	 * POL-R-2 title search: trimmed, blank = no search, longer than a title is rejected. Lowercased
	 * LIKE pattern; '!' escapes the wildcards a user types so they match literally.
	 */
	static String titleSearchPattern(String q) {
		String search = blankToNull(q);
		if (search == null) {
			return null;
		}
		if (search.length() > PlanLimits.RECRUIT_SEARCH_MAX) {
			throw new ApiException(400, "VALIDATION_ERROR", "검색어는 %d자까지 입력할 수 있어요"
					.formatted(PlanLimits.RECRUIT_SEARCH_MAX));
		}
		String escaped = search.toLowerCase(Locale.ROOT)
				.replace("!", "!!")
				.replace("%", "!%")
				.replace("_", "!_");
		return "%" + escaped + "%";
	}

	private static RecruitRoleType parseRole(String role) {
		if (role == null || role.isBlank()) {
			return null;
		}
		try {
			return RecruitRoleType.valueOf(role.trim().toUpperCase(Locale.ROOT));
		}
		catch (IllegalArgumentException ex) {
			throw new ApiException(400, "VALIDATION_ERROR", "역할을 확인해 주세요");
		}
	}

	private static WorkMode parseMode(String mode) {
		if (mode == null || mode.isBlank()) {
			return null;
		}
		try {
			return WorkMode.valueOf(mode.trim().toUpperCase(Locale.ROOT));
		}
		catch (IllegalArgumentException ex) {
			throw new ApiException(400, "VALIDATION_ERROR", "진행 방식을 확인해 주세요");
		}
	}

	private static String blankToNull(String value) {
		if (value == null) {
			return null;
		}
		String trimmed = value.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}
}
