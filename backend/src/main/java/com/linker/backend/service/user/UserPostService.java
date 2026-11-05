package com.linker.backend.service.user;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.dto.post.request.CommentWriteRequest;
import com.linker.backend.dto.post.request.PostPeriodRequest;
import com.linker.backend.dto.post.request.PostPhotoRequest;
import com.linker.backend.dto.post.request.PostWriteRequest;
import com.linker.backend.dto.post.response.CommentResponse;
import com.linker.backend.dto.post.response.EditorRepoListResponse;
import com.linker.backend.dto.post.response.EditorRepoResponse;
import com.linker.backend.dto.post.response.LikeCountResponse;
import com.linker.backend.dto.post.response.LikerItemResponse;
import com.linker.backend.dto.post.response.LikerListResponse;
import com.linker.backend.dto.post.response.PostEditFormResponse;
import com.linker.backend.dto.post.response.PostIdResponse;
import com.linker.backend.dto.post.response.PostPeriodResponse;
import com.linker.backend.dto.post.response.PostPhotoResponse;
import com.linker.backend.dto.post.response.RepoSummaryResponse;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.file.UploadedFile;
import com.linker.backend.entity.github.GithubRepo;
import com.linker.backend.entity.notification.NotificationTypes;
import com.linker.backend.entity.post.Comment;
import com.linker.backend.entity.post.Post;
import com.linker.backend.entity.post.PostDemoLink;
import com.linker.backend.entity.post.PostImage;
import com.linker.backend.entity.post.PostLike;
import com.linker.backend.entity.post.PostTag;
import com.linker.backend.entity.post.PostVisibility;
import com.linker.backend.entity.profile.TechTag;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.RedisRateLimiter;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.github.GithubRepoRepository;
import com.linker.backend.repository.moderation.UserBlockRepository;
import com.linker.backend.repository.post.CommentRepository;
import com.linker.backend.repository.post.PostLikeRepository;
import com.linker.backend.repository.post.PostRepository;
import com.linker.backend.repository.profile.TechTagRepository;
import com.linker.backend.service.recruit.RecruitCardMapper;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserPostService {

	private static final String UNAVAILABLE = "삭제되었거나 볼 수 없는 콘텐츠예요";
	private static final String DELETED_COMMENT = "삭제된 댓글입니다";

	private final GithubRepoRepository repos;
	private final PostRepository posts;
	private final UserRepository users;
	private final TechTagRepository techTags;
	private final UserUploadService uploads;
	private final PostLikeRepository likes;
	private final CommentRepository comments;
	private final UserBlockRepository blocks;
	private final UserNotificationService notifications;
	private final RecruitCardMapper authors;
	private final RedisRateLimiter rateLimiter;
	private final Clock clock;

	public UserPostService(
			GithubRepoRepository repos,
			PostRepository posts,
			UserRepository users,
			TechTagRepository techTags,
			UserUploadService uploads,
			PostLikeRepository likes,
			CommentRepository comments,
			UserBlockRepository blocks,
			UserNotificationService notifications,
			RecruitCardMapper authors,
			RedisRateLimiter rateLimiter,
			Clock clock
	) {
		this.repos = repos;
		this.posts = posts;
		this.users = users;
		this.techTags = techTags;
		this.uploads = uploads;
		this.likes = likes;
		this.comments = comments;
		this.blocks = blocks;
		this.notifications = notifications;
		this.authors = authors;
		this.rateLimiter = rateLimiter;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public EditorRepoListResponse listRepos(AuthenticatedUser user, String q, Long teamId) {
		// team_repos / org membership sync is B-owned; until then team filter yields empty.
		if (teamId != null) {
			return new EditorRepoListResponse(List.of());
		}
		String query = blankToNull(q);
		// Split null-q vs search-q: Postgres + Hibernate bind null string params as bytea in `lower(:q)`.
		List<GithubRepo> rows = query == null
				? repos.findPublicByOwner(user.login())
				: repos.findPublicByOwnerAndQuery(user.login(), query);
		if (rows.isEmpty()) {
			return new EditorRepoListResponse(List.of());
		}
		List<Long> repoIds = rows.stream().map(GithubRepo::getId).toList();
		Set<Long> posted = new HashSet<>(posts.findPostedRepoIds(user.userId(), repoIds));
		List<EditorRepoResponse> items = rows.stream()
				.map(repo -> new EditorRepoResponse(
						repo.getId(),
						repo.getFullName(),
						repo.getPrimaryLanguage(),
						repo.getStargazersCount(),
						repo.isFork(),
						repo.getParentFullName(),
						null,
						posted.contains(repo.getId())
				))
				.toList();
		return new EditorRepoListResponse(items);
	}

	@Transactional(readOnly = true)
	public RepoSummaryResponse repoSummary(AuthenticatedUser user, long repoId) {
		GithubRepo repo = requireOwnedSelectableRepo(user, repoId);
		return toSummary(repo, 0, 0);
	}

	@Transactional
	public PostIdResponse create(AuthenticatedUser user, PostWriteRequest request) {
		if (request == null || request.repoId() == null) {
			throw new ApiException(400, "REPO_REQUIRED", "레포를 골라 주세요");
		}
		GithubRepo repo = requireOwnedSelectableRepo(user, request.repoId());
		if (posts.existsByAuthorIdAndRepoIdAndDeletedAtIsNull(user.userId(), repo.getId())) {
			throw new ApiException(409, "REPO_ALREADY_POSTED", "이미 작업물로 올린 레포예요");
		}
		ValidatedContent content = validateContent(request, user.userId());
		User author = users.findById(user.userId())
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));
		Post post = Post.publish(
				author,
				repo,
				null,
				content.intro(),
				content.body(),
				content.myRole(),
				content.periodStart(),
				content.periodEnd(),
				content.teamSize(),
				0,
				0
		);
		post.replaceImages(content.images());
		post.replaceDemoLinks(content.demoLinks());
		post.replaceTags(content.tags());
		posts.save(post);
		return new PostIdResponse(post.getId());
	}

	@Transactional(readOnly = true)
	public PostEditFormResponse editForm(AuthenticatedUser user, long postId) {
		Post post = requireOwnedPost(user.userId(), postId);
		post.getImages().size();
		post.getDemoLinks().size();
		post.getTags().size();
		List<PostPhotoResponse> photos = post.getImages().stream()
				.map(image -> new PostPhotoResponse(
						Long.toString(image.getFile().getId()),
						image.getFile().getUrl() == null ? "" : image.getFile().getUrl()
				))
				.toList();
		List<String> demos = post.getDemoLinks().stream().map(PostDemoLink::getUrl).toList();
		List<String> tags = post.getTags().stream().map(tag -> tag.getTag().getName()).toList();
		return new PostEditFormResponse(
				post.getId(),
				post.getSummary(),
				post.getBody(),
				photos,
				post.getMyRole(),
				demos,
				toPeriod(post.getPeriodStart(), post.getPeriodEnd()),
				post.getTeamSize(),
				tags,
				toSummary(post.getRepo(), post.getMyCommitCount(), post.getLinkerIssueCount()),
				PlanLimits.POST_PHOTOS_FREE
		);
	}

	@Transactional
	public PostIdResponse update(AuthenticatedUser user, long postId, PostWriteRequest request) {
		Post post = requireOwnedPost(user.userId(), postId);
		post.getImages().size();
		post.getDemoLinks().size();
		post.getTags().size();
		if (request != null && request.repoId() != null && !request.repoId().equals(post.getRepo().getId())) {
			throw new ApiException(400, "VALIDATION_ERROR", "레포는 바꿀 수 없어요");
		}
		ValidatedContent content = validateContent(request, user.userId());
		post.updateContent(
				content.intro(),
				content.body(),
				content.myRole(),
				content.periodStart(),
				content.periodEnd(),
				content.teamSize(),
				clock.instant()
		);
		post.replaceImages(content.images());
		post.replaceDemoLinks(content.demoLinks());
		post.replaceTags(content.tags());
		return new PostIdResponse(post.getId());
	}

	@Transactional
	public LikeCountResponse like(AuthenticatedUser user, long postId) {
		Post post = requireReadablePost(user, postId);
		if (likes.existsByPostIdAndUserId(postId, user.userId())) {
			return new LikeCountResponse(post.getLikeCount());
		}
		User actor = users.findById(user.userId())
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));
		likes.save(PostLike.of(post, actor));
		post.increaseLikeCount();
		long authorId = post.getAuthor().getId();
		if (authorId != user.userId()) {
			notifications.create(new CreateNotificationCommand(
					authorId,
					NotificationTypes.POST_LIKE,
					user.userId(),
					"POST",
					postId,
					"/posts/" + postId,
					null,
					"post-like:" + postId + ":" + user.userId()
			));
		}
		return new LikeCountResponse(post.getLikeCount());
	}

	@Transactional
	public LikeCountResponse unlike(AuthenticatedUser user, long postId) {
		Post post = requireReadablePost(user, postId);
		likes.findByPostIdAndUserId(postId, user.userId()).ifPresent(like -> {
			likes.delete(like);
			post.decreaseLikeCount();
		});
		return new LikeCountResponse(post.getLikeCount());
	}

	@Transactional(readOnly = true)
	public LikerListResponse likers(AuthenticatedUser user, long postId, String cursor) {
		requireReadablePost(user, postId);
		Long cursorId = null;
		if (cursor != null && !cursor.isBlank()) {
			try {
				cursorId = Long.parseLong(cursor.trim());
			}
			catch (NumberFormatException exception) {
				throw new ApiException(400, "VALIDATION_ERROR", "커서를 확인해 주세요");
			}
		}
		int pageSize = 20;
		List<PostLike> rows = likes.findLikers(postId, cursorId, PageRequest.of(0, pageSize + 1));
		boolean hasMore = rows.size() > pageSize;
		List<PostLike> page = hasMore ? rows.subList(0, pageSize) : rows;
		List<LikerItemResponse> items = page.stream()
				.map(like -> new LikerItemResponse(authors.toAuthor(like.getUser())))
				.toList();
		String next = hasMore ? Long.toString(page.getLast().getId()) : null;
		return new LikerListResponse(items, next);
	}

	@Transactional
	public CommentResponse createComment(AuthenticatedUser user, long postId, CommentWriteRequest request) {
		enforceCommentDayLimit(user.userId());
		Post post = requireReadablePost(user, postId);
		String text = requireCommentText(request == null ? null : request.text());
		Comment parent = null;
		Long parentId = request == null ? null : request.parentId();
		if (parentId != null) {
			parent = comments.findDetailedById(parentId)
					.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "댓글을 찾지 못했어요"));
			if (parent.getPost().getId() != postId || parent.getParent() != null || parent.isDeleted()) {
				throw new ApiException(400, "VALIDATION_ERROR", "답글 대상을 확인해 주세요");
			}
		}
		User author = users.findById(user.userId())
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));
		Comment comment = comments.save(Comment.write(post, author, parent, text));
		post.increaseCommentCount();
		notifyComment(post, parent, user.userId(), comment.getId());
		return toCommentResponse(comment);
	}

	@Transactional
	public CommentResponse updateComment(AuthenticatedUser user, long postId, long commentId, CommentWriteRequest request) {
		Comment comment = comments.findDetailedById(commentId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "댓글을 찾지 못했어요"));
		if (comment.getPost().getId() != postId || comment.isDeleted()) {
			throw new ApiException(404, "NOT_FOUND", "댓글을 찾지 못했어요");
		}
		requireReadablePost(user, postId);
		if (comment.getAuthor().getId() != user.userId()) {
			throw new ApiException(403, "FORBIDDEN", "내 댓글이 아니에요");
		}
		String text = requireCommentText(request == null ? null : request.text());
		comment.edit(text, clock.instant());
		return toCommentResponse(comment);
	}

	@Transactional
	public void deleteComment(AuthenticatedUser user, long postId, long commentId) {
		Comment comment = comments.findDetailedById(commentId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "댓글을 찾지 못했어요"));
		if (comment.getPost().getId() != postId || comment.isDeleted()) {
			throw new ApiException(404, "NOT_FOUND", "댓글을 찾지 못했어요");
		}
		Post post = requireReadablePost(user, postId);
		boolean isCommentAuthor = comment.getAuthor().getId() == user.userId();
		boolean isPostOwner = post.getAuthor().getId() == user.userId();
		if (!isCommentAuthor && !isPostOwner) {
			throw new ApiException(403, "FORBIDDEN", "댓글을 삭제할 수 없어요");
		}
		boolean hasReplies = comments.countByParentId(commentId) > 0;
		if (hasReplies) {
			comment.softDelete(clock.instant());
		}
		else {
			comments.delete(comment);
		}
		post.decreaseCommentCount();
	}

	@Transactional
	public void deletePost(AuthenticatedUser user, long postId) {
		Post post = requireOwnedPost(user.userId(), postId);
		Instant now = clock.instant();
		for (Comment comment : comments.findByPostIdOrderByIdAsc(postId)) {
			if (!comment.isDeleted()) {
				comment.softDelete(now);
			}
		}
		likes.deleteByPostId(postId);
		post.softDelete(now);
	}

	private ValidatedContent validateContent(PostWriteRequest request, long userId) {
		if (request == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "게시물 내용을 확인해 주세요");
		}
		String intro = requireText(request.intro(), PlanLimits.POST_INTRO_MIN, PlanLimits.POST_INTRO_MAX, "한 줄 소개를 확인해 주세요");
		String body = request.body() == null ? "" : request.body().trim();
		if (body.length() > PlanLimits.POST_BODY_MAX) {
			throw new ApiException(400, "VALIDATION_ERROR", "본문은 2,000자까지예요");
		}
		String myRole = blankToNull(request.myRole());
		if (myRole != null && myRole.length() > PlanLimits.POST_ROLE_MAX) {
			throw new ApiException(400, "VALIDATION_ERROR", "역할을 확인해 주세요");
		}
		List<PostDemoLink> demoLinks = normalizeDemoLinks(request.demoLinks());
		PeriodDates period = parsePeriod(request.period());
		Integer teamSize = request.teamSize();
		if (teamSize != null
				&& (teamSize < PlanLimits.POST_TEAM_SIZE_MIN || teamSize > PlanLimits.POST_TEAM_SIZE_MAX)) {
			throw new ApiException(400, "VALIDATION_ERROR", "팀 규모를 확인해 주세요");
		}
		List<PostTag> tags = toPostTags(normalizeTags(request.tags()));
		List<PostImage> images = toPostImages(request.photos(), userId);
		return new ValidatedContent(
				intro, body, myRole, period.start(), period.end(), teamSize, images, demoLinks, tags);
	}

	private List<PostImage> toPostImages(List<PostPhotoRequest> photos, long userId) {
		if (photos == null || photos.isEmpty()) {
			return List.of();
		}
		if (photos.size() > PlanLimits.POST_PHOTOS_FREE) {
			throw new ApiException(
					403,
					"PLAN_LIMIT",
					"사진은 5장까지 올릴 수 있어요. Pro로 10장까지 늘릴 수 있어요.",
					Map.of("reason", "POST_PHOTOS")
			);
		}
		List<PostImage> images = new ArrayList<>();
		Set<Long> seen = new HashSet<>();
		int order = 0;
		for (PostPhotoRequest photo : photos) {
			if (photo == null || photo.fileId() == null || photo.fileId().isBlank()) {
				throw new ApiException(400, "VALIDATION_ERROR", "사진을 확인해 주세요");
			}
			long fileId;
			try {
				fileId = Long.parseLong(photo.fileId().trim());
			}
			catch (NumberFormatException exception) {
				throw new ApiException(400, "VALIDATION_ERROR", "사진을 확인해 주세요");
			}
			if (!seen.add(fileId)) {
				throw new ApiException(400, "VALIDATION_ERROR", "사진을 확인해 주세요");
			}
			UploadedFile file = uploads.requireReady(fileId, userId);
			images.add(PostImage.of(file, order++));
		}
		return images;
	}

	private List<PostDemoLink> normalizeDemoLinks(List<String> demoLinks) {
		if (demoLinks == null || demoLinks.isEmpty()) {
			return List.of();
		}
		List<PostDemoLink> links = new ArrayList<>();
		int order = 0;
		for (String raw : demoLinks) {
			String url = blankToNull(raw);
			if (url == null) {
				continue;
			}
			String lower = url.toLowerCase(Locale.ROOT);
			if (!lower.startsWith("https://")) {
				throw new ApiException(400, "VALIDATION_ERROR", "데모 링크는 https만 가능해요");
			}
			links.add(PostDemoLink.of(url, order++));
		}
		if (links.size() > PlanLimits.POST_DEMO_LINKS_MAX) {
			throw new ApiException(400, "VALIDATION_ERROR", "데모 링크는 최대 3개예요");
		}
		return links;
	}

	private List<String> normalizeTags(List<String> tags) {
		if (tags == null || tags.isEmpty()) {
			return List.of();
		}
		List<String> normalized = tags.stream()
				.filter(Objects::nonNull)
				.map(String::trim)
				.filter(tag -> !tag.isEmpty())
				.distinct()
				.toList();
		if (normalized.size() > PlanLimits.POST_TAGS_MAX) {
			throw new ApiException(400, "VALIDATION_ERROR", "태그는 최대 5개예요");
		}
		return normalized;
	}

	private List<PostTag> toPostTags(List<String> names) {
		if (names.isEmpty()) {
			return List.of();
		}
		List<TechTag> found = techTags.findByNameIn(names);
		Map<String, TechTag> byName = new HashMap<>();
		for (TechTag tag : found) {
			byName.put(tag.getName(), tag);
		}
		List<PostTag> tags = new ArrayList<>();
		for (String name : names) {
			TechTag tag = byName.get(name);
			if (tag == null) {
				throw new ApiException(400, "VALIDATION_ERROR", "태그를 확인해 주세요");
			}
			tags.add(PostTag.of(tag));
		}
		return tags;
	}

	/**
	 * Personal-account ownership only until B syncs org membership / team_repos.
	 * Rejects public repos the caller does not own (POL-P-1).
	 */
	private GithubRepo requireOwnedSelectableRepo(AuthenticatedUser user, long repoId) {
		GithubRepo repo = repos.findActiveById(repoId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "레포를 찾지 못했어요"));
		if (!repo.isSelectable()) {
			throw new ApiException(404, "NOT_FOUND", "레포를 찾지 못했어요");
		}
		if (!repo.getOwnerLogin().equalsIgnoreCase(user.login())) {
			throw new ApiException(404, "NOT_FOUND", "레포를 찾지 못했어요");
		}
		return repo;
	}

	private Post requireOwnedPost(long userId, long postId) {
		Post post = posts.findDetailedById(postId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", UNAVAILABLE));
		if (post.getAuthor().getId() != userId) {
			throw new ApiException(403, "FORBIDDEN", "내 게시물이 아니에요");
		}
		return post;
	}

	private Post requireReadablePost(AuthenticatedUser user, long postId) {
		Post post = posts.findDetailedById(postId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", UNAVAILABLE));
		long authorId = post.getAuthor().getId();
		if (blocked(user.userId(), authorId)) {
			throw new ApiException(404, "NOT_FOUND", UNAVAILABLE);
		}
		boolean isAuthor = user.userId() == authorId;
		if (post.getVisibility() != PostVisibility.VISIBLE && !isAuthor) {
			throw new ApiException(404, "NOT_FOUND", UNAVAILABLE);
		}
		return post;
	}

	private boolean blocked(long a, long b) {
		return blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(a, b)
				|| blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(b, a);
	}

	private void enforceCommentDayLimit(long userId) {
		RedisRateLimiter.Decision decision = rateLimiter.tryAcquire(
				"post.comment.day",
				userId,
				PlanLimits.POST_COMMENTS_PER_DAY,
				PlanLimits.POST_COMMENTS_PER_DAY_WINDOW_SECONDS
		);
		if (!decision.allowed()) {
			throw new ApiException(
					429,
					"RATE_LIMITED",
					"요청이 너무 많아요. 잠시 후 다시 시도해 주세요",
					Map.of("retryAfterSeconds", decision.retryAfterSeconds())
			);
		}
	}

	private String requireCommentText(String raw) {
		if (raw == null || raw.isBlank()) {
			throw new ApiException(400, "EMPTY", "내용을 입력해 주세요");
		}
		String text = raw.trim();
		if (text.length() > PlanLimits.POST_COMMENT_MAX) {
			throw new ApiException(400, "TOO_LONG", "500자까지 쓸 수 있어요");
		}
		return text;
	}

	private void notifyComment(Post post, Comment parent, long actorId, long commentId) {
		long postAuthorId = post.getAuthor().getId();
		if (postAuthorId != actorId) {
			notifications.create(new CreateNotificationCommand(
					postAuthorId,
					NotificationTypes.COMMENT,
					actorId,
					"COMMENT",
					commentId,
					"/posts/" + post.getId(),
					null,
					"post-comment:" + post.getId() + ":" + commentId
			));
		}
		if (parent != null) {
			long parentAuthorId = parent.getAuthor().getId();
			if (parentAuthorId != actorId && parentAuthorId != postAuthorId) {
				notifications.create(new CreateNotificationCommand(
						parentAuthorId,
						NotificationTypes.COMMENT,
						actorId,
						"COMMENT",
						commentId,
						"/posts/" + post.getId(),
						null,
						"comment-reply:" + parent.getId() + ":" + commentId
				));
			}
		}
	}

	private CommentResponse toCommentResponse(Comment comment) {
		boolean deleted = comment.isDeleted();
		return new CommentResponse(
				comment.getId(),
				comment.getPost().getId(),
				comment.getParent() == null ? null : comment.getParent().getId(),
				authors.toAuthor(comment.getAuthor()),
				deleted ? DELETED_COMMENT : comment.getBody(),
				deleted,
				comment.getCreatedAt().toString(),
				comment.getEditedAt() == null ? null : comment.getEditedAt().toString()
		);
	}

	private RepoSummaryResponse toSummary(GithubRepo repo, int commitCount, int issueCount) {
		return new RepoSummaryResponse(
				repo.getId(),
				repo.getFullName(),
				repo.getDescription(),
				repo.getPrimaryLanguage(),
				repo.getStargazersCount(),
				repo.getForksCount(),
				repo.isFork(),
				repo.getParentFullName(),
				commitCount,
				issueCount,
				PlanLimits.POST_PHOTOS_FREE
		);
	}

	private static PostPeriodResponse toPeriod(LocalDate start, LocalDate end) {
		if (start == null) {
			return null;
		}
		return new PostPeriodResponse(
				YearMonth.from(start).toString(),
				end == null ? null : YearMonth.from(end).toString()
		);
	}

	private static PeriodDates parsePeriod(PostPeriodRequest period) {
		if (period == null) {
			return new PeriodDates(null, null);
		}
		LocalDate start = parseYearMonth(period.start());
		LocalDate end = parseYearMonth(period.end());
		if (start == null && end != null) {
			throw new ApiException(400, "VALIDATION_ERROR", "기간을 확인해 주세요");
		}
		if (start != null && end != null && end.isBefore(start)) {
			throw new ApiException(400, "VALIDATION_ERROR", "기간을 확인해 주세요");
		}
		return new PeriodDates(start, end);
	}

	private static LocalDate parseYearMonth(String raw) {
		String value = blankToNull(raw);
		if (value == null) {
			return null;
		}
		try {
			return YearMonth.parse(value).atDay(1);
		}
		catch (DateTimeParseException exception) {
			throw new ApiException(400, "VALIDATION_ERROR", "기간을 확인해 주세요");
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

	private record PeriodDates(LocalDate start, LocalDate end) {
	}

	private record ValidatedContent(
			String intro,
			String body,
			String myRole,
			LocalDate periodStart,
			LocalDate periodEnd,
			Integer teamSize,
			List<PostImage> images,
			List<PostDemoLink> demoLinks,
			List<PostTag> tags
	) {
	}
}
