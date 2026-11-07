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
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.moderation.UserBlockRepository;
import com.linker.backend.repository.profile.TechTagRepository;
import com.linker.backend.repository.recruit.ApplicationRepository;
import com.linker.backend.repository.recruit.RecruitPostRepository;
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
				.map(application -> new MyApplicationResponse(
						application.getId(),
						application.getStatus().name(),
						application.getCreatedAt().toString(),
						application.getRecruitRole().getRole().label(),
						cards.toCard(application.getRecruitPost()),
						null
				))
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
		LocalDate maxDeadline = today().plusDays(PlanLimits.RECRUIT_DEADLINE_WITHIN_DAYS);
		return new RecruitEditorOptionsResponse(
				List.of(),
				openCount,
				openCap(user.userId()),
				maxDeadline.toString()
		);
	}

	@Transactional
	public RecruitIdResponse create(AuthenticatedUser user, RecruitWriteRequest request) {
		assertOpenSlotAvailable(user.userId());
		ValidatedWrite validated = validateWrite(request);
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
		post.getTags().size();
		ValidatedWrite validated = validateWrite(request);
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
			throw new ApiException(409, "ROLES_FULL", "모집 인원이 모두 찼어요");
		}
		if (post.getDeadline().isBefore(today())) {
			throw new ApiException(409, "DEADLINE_PASSED", "마감일이 지나 다시 열 수 없어요");
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
		String message = request.message() == null ? "" : request.message().trim();
		if (message.length() > PlanLimits.APPLICATION_MESSAGE_MAX) {
			throw new ApiException(400, "TOO_LONG", "300자까지 쓸 수 있어요");
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
		Application application = Application.pending(
				post,
				role,
				applicant,
				message,
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
				application.getMessage(),
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
		RecruitRole role = application.getRecruitRole();
		boolean increase = request != null && Boolean.TRUE.equals(request.increaseHeadcount());
		if (role.isFull()) {
			if (increase && role.getHeadcount() < PlanLimits.RECRUIT_HEADCOUNT_MAX) {
				role.updateHeadcount(role.getHeadcount() + 1);
			}
			else {
				throw new ApiException(
						409,
						"ROLE_FULL",
						"이 역할은 이미 다 찼어요",
						Map.of("roleId", role.getId(), "headcount", role.getHeadcount())
				);
			}
		}
		// teams/chat tables (B/D) are not introduced yet — cannot join membership/chat.
		// Fail safely with the FE-aligned code so accept does not leave half-applied state.
		throw new ApiException(409, "TEAM_REQUIRED", "팀을 먼저 만들어야 수락할 수 있어요");
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
		RecruitGoal goal = parseGoal(request.goal());
		String duration = blankToNull(request.duration());
		if (duration != null && duration.length() > 40) {
			throw new ApiException(400, "VALIDATION_ERROR", "예상 기간을 확인해 주세요");
		}
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
		LocalDate max = today.plusDays(PlanLimits.RECRUIT_DEADLINE_WITHIN_DAYS);
		if (deadline.isBefore(today) || deadline.isAfter(max)) {
			throw new ApiException(400, "VALIDATION_ERROR", "마감일은 오늘부터 60일 이내여야 해요");
		}
		return deadline;
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
