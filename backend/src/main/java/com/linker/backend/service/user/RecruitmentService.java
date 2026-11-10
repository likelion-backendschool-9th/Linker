package com.linker.backend.service.user;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.dto.recruit.request.AcceptApplicationRequest;
import com.linker.backend.dto.recruit.request.ApplyRecruitRequest;
import com.linker.backend.dto.recruit.request.RecruitRoleWriteRequest;
import com.linker.backend.dto.recruit.request.RecruitWriteRequest;
import com.linker.backend.dto.recruit.request.RejectApplicationRequest;
import com.linker.backend.dto.recruit.response.AcceptApplicationResponse;
import com.linker.backend.dto.recruit.response.ApplicantListItemResponse;
import com.linker.backend.dto.recruit.response.ApplicantListResponse;
import com.linker.backend.dto.recruit.response.ApplicationCreateResponse;
import com.linker.backend.dto.recruit.response.ApplicationSheetResponse;
import com.linker.backend.dto.recruit.response.CompletionBriefResponse;
import com.linker.backend.dto.recruit.response.CursorPage;
import com.linker.backend.dto.recruit.response.MyApplicationResponse;
import com.linker.backend.dto.recruit.response.RecruitCardResponse;
import com.linker.backend.dto.recruit.response.RecruitEditFormResponse;
import com.linker.backend.dto.recruit.response.RecruitEditRoleResponse;
import com.linker.backend.dto.recruit.response.RecruitEditorOptionsResponse;
import com.linker.backend.dto.recruit.response.RecruitIdResponse;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.entity.notification.type.NotificationTypes;
import com.linker.backend.entity.profile.TechTag;
import com.linker.backend.entity.recruit.Application;
import com.linker.backend.entity.recruit.type.ApplicationStatus;
import com.linker.backend.entity.recruit.type.RecruitGoal;
import com.linker.backend.entity.recruit.RecruitPost;
import com.linker.backend.entity.recruit.RecruitPostTag;
import com.linker.backend.entity.recruit.RecruitRole;
import com.linker.backend.entity.recruit.type.RecruitRoleType;
import com.linker.backend.entity.recruit.type.RecruitStatus;
import com.linker.backend.entity.recruit.type.RecruitVisibility;
import com.linker.backend.entity.recruit.type.WorkMode;
import com.linker.backend.entity.team.TeamMember;
import com.linker.backend.entity.team.type.TeamRole;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.chat.ChatRoomRepository;
import com.linker.backend.repository.moderation.UserBlockRepository;
import com.linker.backend.repository.profile.TechTagRepository;
import com.linker.backend.repository.recruit.ApplicationRepository;
import com.linker.backend.repository.recruit.RecruitPostRepository;
import com.linker.backend.repository.subscription.SubscriptionRepository;
import com.linker.backend.repository.team.TeamMemberRepository;
import com.linker.backend.repository.team.TeamRepository;
import com.linker.backend.dto.recruit.mapper.RecruitCardMapper;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service("userRecruitmentService")
public class RecruitmentService {

	private final RecruitPostRepository posts;
	private final ApplicationRepository applications;
	private final UserRepository users;
	private final TechTagRepository techTags;
	private final UserBlockRepository blocks;
	private final RecruitCardMapper cards;
	private final NotificationService notifications;
	private final ProMembership pro;
	private final TeamMemberRepository teamMembers;
	private final TeamRepository teams;
	private final ChatRoomRepository chatRooms;
	private final ChatRoomMemberRepository chatMembers;
	private final SubscriptionRepository subscriptions;
	private final Clock clock;

	public RecruitmentService(
			RecruitPostRepository posts,
			ApplicationRepository applications,
			UserRepository users,
			TechTagRepository techTags,
			UserBlockRepository blocks,
			RecruitCardMapper cards,
			NotificationService notifications,
			ProMembership pro,
			TeamMemberRepository teamMembers,
			TeamRepository teams,
			ChatRoomRepository chatRooms,
			ChatRoomMemberRepository chatMembers,
			SubscriptionRepository subscriptions,
			Clock clock
	) {
		this.posts = posts;
		this.applications = applications;
		this.users = users;
		this.techTags = techTags;
		this.blocks = blocks;
		this.cards = cards;
		this.notifications = notifications;
		this.pro = pro;
		this.teamMembers = teamMembers;
		this.teams = teams;
		this.chatRooms = chatRooms;
		this.chatMembers = chatMembers;
		this.subscriptions = subscriptions;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public CursorPage<RecruitCardResponse> myRecruits(AuthenticatedUser user, String cursor) {
		int offset = parseOffset(cursor);
		List<RecruitPost> rows = posts.findMine(user.userId(), PageRequest.of(0, 500));
		int from = Math.min(offset, rows.size());
		int to = Math.min(from + PlanLimits.RECRUIT_PAGE_SIZE, rows.size());
		List<RecruitCardResponse> items = rows.subList(from, to).stream().map(cards::toCard).toList();
		String next = to < rows.size() ? Integer.toString(to) : null;
		return new CursorPage<>(items, next);
	}

	@Transactional(readOnly = true)
	public CursorPage<MyApplicationResponse> myApplications(AuthenticatedUser user, String status, String cursor) {
		ApplicationStatus filter = parseStatus(status);
		int offset = parseOffset(cursor);
		List<Application> rows = applications.findMine(
				user.userId(), filter, ApplicationStatus.CANCELED, PageRequest.of(0, 500));
		int from = Math.min(offset, rows.size());
		int to = Math.min(from + PlanLimits.RECRUIT_PAGE_SIZE, rows.size());
		List<MyApplicationResponse> items = rows.subList(from, to).stream()
				.map(application -> {
					Long chatRoomId = null;
					if (application.getStatus() == ApplicationStatus.ACCEPTED) {
						Long teamId = application.getRecruitPost().getTeamId();
						if (teamId != null) {
							chatRoomId = chatRooms.findTeamRoom(teamId).map(room -> room.getId()).orElse(null);
						}
					}
					return new MyApplicationResponse(
							application.getId(),
							application.getStatus().name(),
							application.getCreatedAt().toString(),
							application.getRecruitRole().getRole().label(),
							cards.toCard(application.getRecruitPost()),
							chatRoomId
					);
				})
				.toList();
		String next = to < rows.size() ? Integer.toString(to) : null;
		return new CursorPage<>(items, next);
	}

	@Transactional
	public void cancelApplication(AuthenticatedUser user, long applicationId) {
		Application application = applications.findDetailedById(applicationId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "지원 내역을 찾지 못했어요"));
		if (application.getApplicant().getId() != user.userId()) {
			throw new ApiException(404, "NOT_FOUND", "지원 내역을 찾지 못했어요");
		}
		if (application.getStatus() != ApplicationStatus.PENDING) {
			throw new ApiException(409, "NOT_PENDING", "검토 중인 지원만 취소할 수 있어요");
		}
		application.cancel();
	}

	@Transactional(readOnly = true)
	public RecruitEditorOptionsResponse editorOptions(AuthenticatedUser user) {
		int openCount = (int) posts.countByAuthorIdAndStatusAndDeletedAtIsNull(
				user.userId(), RecruitStatus.OPEN);
		LocalDate maxDeadline = maxDeadline(today());
		return new RecruitEditorOptionsResponse(
				teamMembers.findRecruitLinkableTeams(user.userId()),
				openCount,
				openCap(user.userId()),
				maxDeadline.toString()
		);
	}

	@Transactional
	public RecruitIdResponse create(AuthenticatedUser user, RecruitWriteRequest request) {
		assertOpenSlotAvailable(user.userId());
		ValidatedWrite validated = validateWrite(request);
		requireLinkableTeam(user.userId(), validated.teamId(), null);
		User author = users.findById(user.userId())
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));
		Instant now = clock.instant();
		RecruitPost post = RecruitPost.open(
				author,
				validated.title(),
				validated.intro(),
				validated.workMode(),
				validated.region(),
				validated.goal(),
				validated.duration(),
				validated.deadline(),
				now
		);
		post.assignTeam(validated.teamId());
		for (RecruitRoleWriteRequest role : validated.roles()) {
			post.addRole(RecruitRole.of(parseRole(role.role()), role.headcount()));
		}
		post.replaceTags(toPostTags(validated.techTags()));
		posts.save(post);
		return new RecruitIdResponse(post.getId());
	}

	@Transactional(readOnly = true)
	public RecruitEditFormResponse editForm(AuthenticatedUser user, long recruitId) {
		RecruitPost post = requireOwnedPost(user.userId(), recruitId);
		post.getTags().size();
		List<Long> lockedRoleIds = applications.findLockedRoleIds(post.getId(), ApplicationStatus.CANCELED);
		Map<String, Integer> minHeadcount = new LinkedHashMap<>();
		for (RecruitRole role : post.getRoles()) {
			minHeadcount.put(Long.toString(role.getId()), role.getAcceptedCount());
		}
		List<RecruitEditRoleResponse> roles = post.getRoles().stream()
				.map(role -> new RecruitEditRoleResponse(
						role.getId(),
						role.getRole().name(),
						role.getRole().label(),
						role.getHeadcount(),
						role.getAcceptedCount()
				))
				.toList();
		List<String> tags = post.getTags().stream().map(tag -> tag.getTag().getName()).toList();
		return new RecruitEditFormResponse(
				post.getId(),
				post.getTitle(),
				post.getDescription(),
				roles,
				post.getWorkMode().name(),
				post.getRegion(),
				post.getGoal() == null ? null : post.getGoal().name(),
				post.getExpectedPeriod(),
				post.getDeadline().toString(),
				tags,
				post.getTeamId(),
				post.getStatus().name(),
				lockedRoleIds,
				minHeadcount
		);
	}

	@Transactional
	public RecruitIdResponse update(AuthenticatedUser user, long recruitId, RecruitWriteRequest request) {
		RecruitPost post = requireOwnedPost(user.userId(), recruitId);
		requireLinkedTeamManager(user.userId(), post.getTeamId());
		post.getTags().size();
		ValidatedWrite validated = validateWrite(request);
		requireLinkableTeam(user.userId(), validated.teamId(), post.getTeamId());
		Set<Long> locked = new HashSet<>(
				applications.findLockedRoleIds(post.getId(), ApplicationStatus.CANCELED));
		applyRoleEdits(post, validated.roles(), locked);
		post.updateContent(
				validated.title(),
				validated.intro(),
				validated.workMode(),
				validated.region(),
				validated.goal(),
				validated.duration(),
				validated.deadline()
		);
		post.assignTeam(validated.teamId());
		post.replaceTags(toPostTags(validated.techTags()));
		if (post.getStatus() == RecruitStatus.OPEN && post.allRolesFull()) {
			post.close(clock.instant());
		}
		return new RecruitIdResponse(post.getId());
	}

	@Transactional
	public void close(AuthenticatedUser user, long recruitId) {
		RecruitPost post = requireOwnedPost(user.userId(), recruitId);
		if (post.getStatus() == RecruitStatus.CLOSED) {
			return;
		}
		post.close(clock.instant());
	}

	@Transactional
	public void reopen(AuthenticatedUser user, long recruitId) {
		RecruitPost post = requireOwnedPost(user.userId(), recruitId);
		if (post.getStatus() == RecruitStatus.OPEN) {
			return;
		}
		if (post.allRolesFull()) {
			throw new ApiException(409, "ROLES_FULL", "모집 인원이 모두 찼어요. 인원을 늘린 뒤 다시 열어 주세요.");
		}
		if (post.getDeadline().isBefore(today())) {
			throw new ApiException(409, "DEADLINE_PASSED", "마감일이 지났어요. 마감일을 바꾼 뒤 다시 열어 주세요.");
		}
		assertOpenSlotAvailable(user.userId());
		post.reopen();
	}

	@Transactional
	public void delete(AuthenticatedUser user, long recruitId) {
		RecruitPost post = requireOwnedPost(user.userId(), recruitId);
		List<Application> pending = applications.findPendingByRecruitPostId(
				post.getId(), ApplicationStatus.PENDING);
		for (Application application : pending) {
			application.expire();
			notifications.create(new CreateNotificationCommand(
					application.getApplicant().getId(),
					NotificationTypes.APPLICATION_EXPIRED,
					user.userId(),
					"RECRUIT_POST",
					post.getId(),
					"/recruits/" + post.getId(),
					null,
					"application-expired:" + application.getId()
			));
		}
		post.softDelete(clock.instant());
	}

	@Transactional
	public int autoCloseEligiblePosts() {
		LocalDate today = today();
		Instant now = clock.instant();
		int closed = 0;
		for (RecruitPost post : posts.findOpenWithRoles(RecruitStatus.OPEN)) {
			if (post.getDeadline().isBefore(today) || post.allRolesFull()) {
				post.close(now);
				closed++;
			}
		}
		return closed;
	}

	@Transactional
	public ApplicationCreateResponse apply(AuthenticatedUser user, long recruitId, ApplyRecruitRequest request) {
		RecruitPost post = posts.findDetailedById(recruitId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "삭제되었거나 볼 수 없는 콘텐츠예요"));
		if (post.getVisibility() != RecruitVisibility.VISIBLE) {
			throw new ApiException(404, "NOT_FOUND", "삭제되었거나 볼 수 없는 콘텐츠예요");
		}
		if (post.getAuthor().getId() == user.userId()) {
			throw new ApiException(403, "FORBIDDEN", "내 모집 글에는 지원할 수 없어요");
		}
		if (post.getTeamId() != null
				&& teamMembers.findByTeamIdAndUserIdAndLeftAtIsNull(post.getTeamId(), user.userId()).isPresent()) {
			throw new ApiException(403, "FORBIDDEN", "이미 팀에 속해 있어요");
		}
		if (post.getStatus() == RecruitStatus.CLOSED) {
			throw new ApiException(409, "RECRUIT_CLOSED", "모집이 끝났어요");
		}
		long authorId = post.getAuthor().getId();
		if (blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(user.userId(), authorId)
				|| blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(authorId, user.userId())) {
			throw new ApiException(403, "FORBIDDEN", "차단된 사용자와는 지원할 수 없어요");
		}
		if (request == null || request.roleId() == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "역할을 확인해 주세요");
		}
		RecruitRole role = post.getRoles().stream()
				.filter(item -> item.getId().equals(request.roleId()))
				.findFirst()
				.orElseThrow(() -> new ApiException(400, "VALIDATION_ERROR", "역할을 확인해 주세요"));
		List<Application> history = applications.findByRecruitPostIdAndApplicantId(post.getId(), user.userId());
		if (history.stream().anyMatch(item -> item.getStatus() == ApplicationStatus.PENDING)) {
			throw new ApiException(409, "ALREADY_APPLIED", "이미 지원한 모집 글이에요");
		}
		if (history.stream().anyMatch(item ->
				item.getStatus() == ApplicationStatus.ACCEPTED
						|| item.getStatus() == ApplicationStatus.REJECTED
						|| item.getStatus() == ApplicationStatus.EXPIRED)) {
			throw new ApiException(409, "ALREADY_APPLIED", "이미 지원한 모집 글이에요");
		}
		int maxAttempt = history.stream().mapToInt(Application::getAttempt).max().orElse(0);
		if (maxAttempt >= PlanLimits.APPLICATION_MAX_ATTEMPTS) {
			throw new ApiException(409, "ALREADY_APPLIED", "이미 지원한 모집 글이에요");
		}
		User applicant = users.findById(user.userId())
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));
		Instant now = clock.instant();
		// POL-R-3: no free-text "하고 싶은 말"; author reviews the public profile instead.
		Application application = Application.pending(
				post,
				role,
				applicant,
				"",
				maxAttempt + 1,
				now.plusSeconds(PlanLimits.APPLICATION_EXPIRE_DAYS * 24L * 3600L)
		);
		applications.save(application);
		notifications.create(new CreateNotificationCommand(
				authorId,
				NotificationTypes.APPLICATION_RECEIVED,
				user.userId(),
				"RECRUIT_POST",
				post.getId(),
				"/recruits/" + post.getId(),
				null,
				"application-received:" + application.getId()
		));
		return new ApplicationCreateResponse(application.getId(), application.getStatus().name());
	}

	@Transactional(readOnly = true)
	public ApplicantListResponse listApplicants(AuthenticatedUser user, long recruitId, Long roleId) {
		RecruitPost post = requireOwnedPost(user.userId(), recruitId);
		List<Application> rows = applications.findForAuthor(post.getId(), roleId, ApplicationStatus.CANCELED);
		Instant now = clock.instant();
		List<ApplicantListItemResponse> items = rows.stream()
				.map(application -> new ApplicantListItemResponse(
						application.getId(),
						cards.toAuthor(application.getApplicant()),
						application.getRecruitRole().getId(),
						application.getRecruitRole().getRole().label(),
						application.getStatus().name(),
						application.getCreatedAt().toString(),
						daysLeft(application.getExpiresAt(), now)
				))
				.toList();
		return new ApplicantListResponse(
				post.getRoles().stream().map(cards::toRole).toList(),
				items
		);
	}

	@Transactional(readOnly = true)
	public ApplicationSheetResponse applicationSheet(
			AuthenticatedUser user,
			long recruitId,
			long applicationId
	) {
		requireOwnedPost(user.userId(), recruitId);
		Application application = applications.findDetailedForPost(recruitId, applicationId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "지원 내역을 찾지 못했어요"));
		return new ApplicationSheetResponse(
				application.getId(),
				application.getStatus().name(),
				application.getCreatedAt().toString(),
				cards.toAuthor(application.getApplicant()),
				List.of(),
				new CompletionBriefResponse(0, 0),
				List.of(),
				List.of()
		);
	}

	@Transactional
	public AcceptApplicationResponse accept(
			AuthenticatedUser user,
			long recruitId,
			long applicationId,
			AcceptApplicationRequest request
	) {
		RecruitPost post = requireOwnedPost(user.userId(), recruitId);
		Application application = applications.findDetailedForPost(recruitId, applicationId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "지원 내역을 찾지 못했어요"));
		if (application.getStatus() != ApplicationStatus.PENDING) {
			throw new ApiException(409, "NOT_PENDING", "검토 중인 지원만 수락할 수 있어요");
		}
		if (post.getTeamId() == null) {
			throw new ApiException(409, "TEAM_REQUIRED", "팀을 먼저 만들어야 수락할 수 있어요");
		}
		long teamId = post.getTeamId();
		RecruitRole role = application.getRecruitRole();
		boolean increase = request != null && Boolean.TRUE.equals(request.increaseHeadcount());
		if (role.isFull()) {
			if (!increase || role.getHeadcount() >= PlanLimits.RECRUIT_HEADCOUNT_MAX) {
				throw new ApiException(
						409,
						"ROLE_FULL",
						"이 역할은 이미 다 찼어요",
						Map.of("roleId", role.getId(), "headcount", role.getHeadcount())
				);
			}
			// "인원 늘리고 수락" requires Flex (paid seats) — free teams cannot bump headcount here.
			if (!subscriptions.hasFlexBenefit(teamId, clock.instant())) {
				throw new ApiException(
						403,
						"PLAN_LIMIT",
						"역할 인원을 늘리려면 Flex 구독이 필요해요.",
						Map.of("reason", "ROLE_HEADCOUNT")
				);
			}
			role.updateHeadcount(role.getHeadcount() + 1);
		}

		long applicantId = application.getApplicant().getId();
		boolean alreadyMember = teamMembers.findByTeamIdAndUserIdAndLeftAtIsNull(teamId, applicantId).isPresent();
		if (!alreadyMember) {
			assertTeamCanAcceptMember(teamId, applicantId);
			teamMembers.saveAndFlush(TeamMember.member(teamId, applicantId, clock.instant()));
		}

		ChatRoom room = chatRooms.lockTeamRoom(teamId)
				.orElseThrow(() -> new ApiException(409, "TEAM_REQUIRED", "팀 채팅방을 찾지 못했어요"));
		ensureTeamChatMember(room, applicantId);

		User author = users.findById(user.userId())
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));
		application.accept(author, clock.instant());
		role.incrementAccepted();
		if (post.getStatus() == RecruitStatus.OPEN && post.allRolesFull()) {
			post.close(clock.instant());
		}

		notifications.create(new CreateNotificationCommand(
				applicantId,
				NotificationTypes.APPLICATION_ACCEPTED,
				user.userId(),
				"RECRUIT_POST",
				recruitId,
				"/chats/" + room.getId(),
				null,
				"application-accepted:" + application.getId()
		));

		boolean needsGithubInvite = teamMembers
				.findByTeamIdAndUserIdAndLeftAtIsNull(teamId, user.userId())
				.map(member -> member.getRole() == TeamRole.OWNER)
				.orElse(false);
		return new AcceptApplicationResponse(teamId, room.getId(), needsGithubInvite);
	}

	/** Free teams stop at 6; Flex has no member cap. Applicant also respects the personal 10-team cap. */
	private void assertTeamCanAcceptMember(long teamId, long applicantId) {
		boolean flex = subscriptions.hasFlexBenefit(teamId, clock.instant());
		int current = teamMembers.findByTeamIdAndLeftAtIsNullOrderByJoinedAtAscIdAsc(teamId).size();
		if (!flex && current >= PlanLimits.TEAM_MEMBERS_FREE) {
			throw new ApiException(
					403,
					"PLAN_LIMIT",
					"무료 팀은 멤버 " + PlanLimits.TEAM_MEMBERS_FREE + "명까지예요. Flex로 더 초대할 수 있어요.",
					Map.of("reason", "TEAM_MEMBERS")
			);
		}
		if (teams.countedTeams(applicantId) >= PlanLimits.TEAMS_PER_USER_MAX) {
			throw new ApiException(
					403,
					"PLAN_LIMIT",
					"팀은 " + PlanLimits.TEAMS_PER_USER_MAX + "개까지 참여할 수 있어요",
					Map.of("reason", "TEAMS_PER_USER")
			);
		}
	}

	private void ensureTeamChatMember(ChatRoom room, long userId) {
		ChatRoomMember existing = chatMembers.findAnyInRoom(room.getId(), userId).orElse(null);
		if (existing == null) {
			chatMembers.saveAndFlush(ChatRoomMember.join(room, userId));
			return;
		}
		if (existing.getLeftAt() != null || existing.getHiddenAt() != null) {
			existing.rejoin();
		}
	}

	@Transactional
	public void reject(
			AuthenticatedUser user,
			long recruitId,
			long applicationId,
			RejectApplicationRequest request
	) {
		requireOwnedPost(user.userId(), recruitId);
		Application application = applications.findDetailedForPost(recruitId, applicationId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "지원 내역을 찾지 못했어요"));
		if (application.getStatus() != ApplicationStatus.PENDING) {
			throw new ApiException(409, "NOT_PENDING", "검토 중인 지원만 거절할 수 있어요");
		}
		User author = users.findById(user.userId())
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));
		String reason = request == null ? null : blankToNull(request.reason());
		if (reason != null && reason.length() > PlanLimits.APPLICATION_MESSAGE_MAX) {
			throw new ApiException(400, "VALIDATION_ERROR", "거절 사유를 확인해 주세요");
		}
		application.reject(reason, author, clock.instant());
		notifications.create(new CreateNotificationCommand(
				application.getApplicant().getId(),
				NotificationTypes.APPLICATION_REJECTED,
				user.userId(),
				"RECRUIT_POST",
				recruitId,
				"/recruits/" + recruitId,
				null,
				"application-rejected:" + application.getId()
		));
	}

	@Transactional
	public int expireOverdueApplications() {
		Instant now = clock.instant();
		List<Application> overdue = applications.findExpiredPending(ApplicationStatus.PENDING, now);
		for (Application application : overdue) {
			application.expire();
			notifications.create(new CreateNotificationCommand(
					application.getApplicant().getId(),
					NotificationTypes.APPLICATION_EXPIRED,
					null,
					"RECRUIT_POST",
					application.getRecruitPost().getId(),
					"/recruits/" + application.getRecruitPost().getId(),
					null,
					"application-expired:" + application.getId()
			));
		}
		return overdue.size();
	}

	private static int daysLeft(Instant expiresAt, Instant now) {
		long seconds = expiresAt.getEpochSecond() - now.getEpochSecond();
		if (seconds <= 0) {
			return 0;
		}
		return (int) Math.ceil(seconds / 86_400.0);
	}

	private void applyRoleEdits(
			RecruitPost post,
			List<RecruitRoleWriteRequest> requested,
			Set<Long> locked
	) {
		Map<Long, RecruitRole> existing = post.getRoles().stream()
				.filter(role -> role.getId() != null)
				.collect(Collectors.toMap(RecruitRole::getId, role -> role));
		Set<Long> kept = new HashSet<>();
		for (RecruitRoleWriteRequest item : requested) {
			RecruitRoleType nextType = parseRole(item.role());
			if (item.id() == null) {
				post.addRole(RecruitRole.of(nextType, item.headcount()));
				continue;
			}
			RecruitRole role = existing.get(item.id());
			if (role == null) {
				throw new ApiException(400, "VALIDATION_ERROR", "역할을 확인해 주세요");
			}
			if (item.headcount() < role.getAcceptedCount()) {
				throw new ApiException(409, "HEADCOUNT_TOO_LOW", "이미 수락한 인원보다 적을 수 없어요");
			}
			if (role.getRole() != nextType) {
				if (locked.contains(role.getId())) {
					throw new ApiException(409, "ROLE_LOCKED", "지원자가 있는 역할은 바꿀 수 없어요");
				}
				post.removeRole(role);
				post.addRole(RecruitRole.of(nextType, item.headcount()));
				continue;
			}
			kept.add(role.getId());
			role.updateHeadcount(item.headcount());
		}
		for (RecruitRole role : List.copyOf(post.getRoles())) {
			if (role.getId() == null || !existing.containsKey(role.getId()) || kept.contains(role.getId())) {
				continue;
			}
			if (locked.contains(role.getId())) {
				throw new ApiException(409, "ROLE_LOCKED", "지원자가 있는 역할은 삭제할 수 없어요");
			}
			post.removeRole(role);
		}
	}

	private RecruitPost requireOwnedPost(long userId, long recruitId) {
		RecruitPost post = posts.findDetailedById(recruitId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "삭제되었거나 볼 수 없는 콘텐츠예요"));
		if (post.getAuthor().getId() != userId) {
			throw new ApiException(403, "FORBIDDEN", "내 모집 글이 아니에요");
		}
		return post;
	}

	private void assertOpenSlotAvailable(long authorId) {
		long openCount = posts.countByAuthorIdAndStatusAndDeletedAtIsNull(authorId, RecruitStatus.OPEN);
		int cap = openCap(authorId);
		if (openCount >= cap) {
			throw new ApiException(
					403,
					"PLAN_LIMIT",
					cap >= PlanLimits.OPEN_RECRUIT_POSTS_PRO
							? "동시에 모집할 수 있는 글은 " + cap + "개까지예요."
							: "동시에 모집할 수 있는 글은 3개까지예요. Pro로 10개까지 늘릴 수 있어요.",
					Map.of("reason", "RECRUIT_POSTS")
			);
		}
	}

	/** POL-R-1 / Policy ch. 11: Pro 10 open posts. After Pro ends, open posts stay; new opens use 3. */
	private int openCap(long authorId) {
		return pro.active(authorId, clock.instant()) ? PlanLimits.OPEN_RECRUIT_POSTS_PRO : PlanLimits.OPEN_RECRUIT_POSTS_FREE;
	}

	/**
	 * POL-R-1: editing needs the author to still own or admin the linked team (invites on 21 add
	 * people to it). A post saved before a team became required has none and skips this.
	 */
	private void requireLinkedTeamManager(long userId, Long teamId) {
		if (teamId == null) {
			return;
		}
		boolean manager = teamMembers.findByTeamIdAndUserIdAndLeftAtIsNull(teamId, userId)
				.map(TeamMember::getRole)
				.filter(role -> role == TeamRole.OWNER || role == TeamRole.ADMIN)
				.isPresent();
		if (!manager) {
			throw new ApiException(403, "TEAM_ROLE_REQUIRED", "글을 수정할 권한이 없습니다.");
		}
	}

	/**
	 * POL-R-1: every post links a team the author owns or admins, since invites on 21 add people
	 * to it. On edit the team already linked may stay ({@link #requireLinkedTeamManager} already
	 * checked the author still owns or admins it).
	 */
	private void requireLinkableTeam(long userId, Long teamId, Long currentTeamId) {
		if (teamId == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "연결할 팀을 선택해 주세요");
		}
		if (teamId.equals(currentTeamId)) {
			return;
		}
		boolean linkable = teamMembers.findRecruitLinkableTeams(userId).stream()
				.anyMatch(team -> team.id() == teamId);
		if (!linkable) {
			throw new ApiException(403, "FORBIDDEN", "모집 글에 연결할 수 없는 팀이에요");
		}
	}

	private ValidatedWrite validateWrite(RecruitWriteRequest request) {
		if (request == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "모집 글 내용을 확인해 주세요");
		}
		String title = requireText(request.title(), 1, PlanLimits.RECRUIT_TITLE_MAX, "제목을 확인해 주세요");
		String intro = requireText(request.intro(), 1, PlanLimits.RECRUIT_INTRO_MAX, "소개를 확인해 주세요");
		WorkMode workMode = parseWorkMode(request.format());
		String region = blankToNull(request.region());
		if (workMode == WorkMode.OFFLINE && (region == null || region.isBlank())) {
			throw new ApiException(400, "VALIDATION_ERROR", "오프라인 모집은 지역이 필요해요");
		}
		// Column length guard, counted like PostgreSQL varchar (code points)
		if (region != null && region.codePointCount(0, region.length()) > PlanLimits.RECRUIT_REGION_MAX) {
			throw new ApiException(400, "VALIDATION_ERROR",
					"지역은 " + PlanLimits.RECRUIT_REGION_MAX + "자까지 쓸 수 있어요");
		}
		RecruitGoal goal = parseGoal(request.goal());
		String duration = blankToNull(request.duration());
		if (duration != null && duration.length() > 40) {
			throw new ApiException(400, "VALIDATION_ERROR", "예상 기간을 확인해 주세요");
		}
		rejectEmoji(title, intro, region, duration);
		LocalDate deadline = parseDeadline(request.deadline());
		List<RecruitRoleWriteRequest> roles = normalizeRoles(request.roles());
		List<String> tags = normalizeTechTags(request.techTags());
		return new ValidatedWrite(
				title, intro, roles, workMode, region, goal, duration, deadline, tags, request.teamId());
	}

	private List<RecruitRoleWriteRequest> normalizeRoles(List<RecruitRoleWriteRequest> roles) {
		if (roles == null || roles.isEmpty()) {
			throw new ApiException(400, "VALIDATION_ERROR", "모집 역할을 추가해 주세요");
		}
		List<RecruitRoleWriteRequest> normalized = new ArrayList<>();
		for (RecruitRoleWriteRequest role : roles) {
			if (role == null || role.headcount() == null) {
				throw new ApiException(400, "VALIDATION_ERROR", "역할 인원을 확인해 주세요");
			}
			if (role.headcount() < PlanLimits.RECRUIT_HEADCOUNT_MIN
					|| role.headcount() > PlanLimits.RECRUIT_HEADCOUNT_MAX) {
				throw new ApiException(400, "VALIDATION_ERROR", "역할 인원은 1~10명이에요");
			}
			parseRole(role.role());
			normalized.add(role);
		}
		return normalized;
	}

	private List<String> normalizeTechTags(List<String> techTags) {
		if (techTags == null || techTags.isEmpty()) {
			return List.of();
		}
		if (techTags.size() > PlanLimits.RECRUIT_TECH_TAGS_MAX) {
			throw new ApiException(400, "VALIDATION_ERROR", "기술 스택은 최대 10개예요");
		}
		List<String> names = techTags.stream()
				.filter(Objects::nonNull)
				.map(String::trim)
				.filter(name -> !name.isEmpty())
				.distinct()
				.toList();
		if (names.size() > PlanLimits.RECRUIT_TECH_TAGS_MAX) {
			throw new ApiException(400, "VALIDATION_ERROR", "기술 스택은 최대 10개예요");
		}
		return names;
	}

	private List<RecruitPostTag> toPostTags(List<String> names) {
		if (names.isEmpty()) {
			return List.of();
		}
		List<TechTag> found = techTags.findByNameIn(names);
		Map<String, TechTag> byName = new HashMap<>();
		for (TechTag tag : found) {
			byName.put(tag.getName(), tag);
		}
		List<RecruitPostTag> tags = new ArrayList<>();
		for (String name : names) {
			TechTag tag = byName.get(name);
			if (tag == null) {
				throw new ApiException(400, "VALIDATION_ERROR", "기술 스택을 확인해 주세요");
			}
			tags.add(RecruitPostTag.of(tag));
		}
		return tags;
	}

	private LocalDate parseDeadline(String raw) {
		if (raw == null || raw.isBlank()) {
			throw new ApiException(400, "VALIDATION_ERROR", "마감일을 확인해 주세요");
		}
		LocalDate deadline;
		try {
			deadline = LocalDate.parse(raw.trim());
		}
		catch (RuntimeException exception) {
			throw new ApiException(400, "VALIDATION_ERROR", "마감일을 확인해 주세요");
		}
		LocalDate today = today();
		if (deadline.isBefore(today) || deadline.isAfter(maxDeadline(today))) {
			throw new ApiException(400, "VALIDATION_ERROR",
					"마감일은 오늘부터 " + PlanLimits.RECRUIT_DEADLINE_WITHIN_MONTHS + "개월 이내여야 해요");
		}
		return deadline;
	}

	/** POL-R-1: last allowed deadline, same calendar day 6 months on (month end clamps, e.g. 8/31 → 2/28). */
	private static LocalDate maxDeadline(LocalDate today) {
		return today.plusMonths(PlanLimits.RECRUIT_DEADLINE_WITHIN_MONTHS);
	}

	private static WorkMode parseWorkMode(String raw) {
		if (raw == null || raw.isBlank()) {
			throw new ApiException(400, "VALIDATION_ERROR", "진행 방식을 확인해 주세요");
		}
		try {
			return WorkMode.valueOf(raw.trim().toUpperCase(Locale.ROOT));
		}
		catch (IllegalArgumentException exception) {
			throw new ApiException(400, "VALIDATION_ERROR", "진행 방식을 확인해 주세요");
		}
	}

	private static RecruitGoal parseGoal(String raw) {
		if (raw == null || raw.isBlank()) {
			return null;
		}
		try {
			return RecruitGoal.valueOf(raw.trim().toUpperCase(Locale.ROOT));
		}
		catch (IllegalArgumentException exception) {
			throw new ApiException(400, "VALIDATION_ERROR", "목표를 확인해 주세요");
		}
	}

	private static RecruitRoleType parseRole(String raw) {
		if (raw == null || raw.isBlank()) {
			throw new ApiException(400, "VALIDATION_ERROR", "역할을 확인해 주세요");
		}
		try {
			return RecruitRoleType.valueOf(raw.trim().toUpperCase(Locale.ROOT));
		}
		catch (IllegalArgumentException exception) {
			throw new ApiException(400, "VALIDATION_ERROR", "역할을 확인해 주세요");
		}
	}

	/** POL-R-1: recruit post text takes no emoji (FE `hasEmoji` uses the same code points). */
	private static void rejectEmoji(String... values) {
		for (String value : values) {
			if (value != null && value.codePoints().anyMatch(RecruitmentService::isEmojiCodePoint)) {
				throw new ApiException(400, "VALIDATION_ERROR", "이모지는 입력할 수 없어요.");
			}
		}
	}

	/** Emoji shown as pictures by default, flag letters, and the emoji-style / keycap marks */
	private static boolean isEmojiCodePoint(int codePoint) {
		return Character.isEmojiPresentation(codePoint)
				|| (codePoint >= 0x1F1E6 && codePoint <= 0x1F1FF)
				|| codePoint == 0xFE0F
				|| codePoint == 0x20E3;
	}

	private static String requireText(String raw, int min, int max, String message) {
		if (raw == null) {
			throw new ApiException(400, "VALIDATION_ERROR", message);
		}
		String value = raw.trim();
		if (value.length() < min || value.length() > max) {
			throw new ApiException(400, "VALIDATION_ERROR", message);
		}
		return value;
	}

	private static String blankToNull(String raw) {
		if (raw == null) {
			return null;
		}
		String value = raw.trim();
		return value.isEmpty() ? null : value;
	}

	private LocalDate today() {
		return LocalDate.now(clock);
	}

	private static ApplicationStatus parseStatus(String raw) {
		if (raw == null || raw.isBlank()) {
			return null;
		}
		String value = raw.trim().toUpperCase(Locale.ROOT);
		if ("CANCELLED".equals(value)) {
			value = "CANCELED";
		}
		try {
			ApplicationStatus status = ApplicationStatus.valueOf(value);
			if (status == ApplicationStatus.CANCELED) {
				throw new ApiException(400, "VALIDATION_ERROR", "지원 상태를 확인해 주세요");
			}
			return status;
		}
		catch (IllegalArgumentException exception) {
			throw new ApiException(400, "VALIDATION_ERROR", "지원 상태를 확인해 주세요");
		}
	}

	private static int parseOffset(String cursor) {
		if (cursor == null || cursor.isBlank()) {
			return 0;
		}
		try {
			int offset = Integer.parseInt(cursor.trim());
			if (offset < 0) {
				throw new NumberFormatException("negative");
			}
			return offset;
		}
		catch (NumberFormatException exception) {
			throw new ApiException(400, "VALIDATION_ERROR", "커서를 확인해 주세요");
		}
	}

	private record ValidatedWrite(
			String title,
			String intro,
			List<RecruitRoleWriteRequest> roles,
			WorkMode workMode,
			String region,
			RecruitGoal goal,
			String duration,
			LocalDate deadline,
			List<String> techTags,
			Long teamId
	) {
	}
}
