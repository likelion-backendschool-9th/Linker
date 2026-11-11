package com.linker.backend.service.user;

import java.text.BreakIterator;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.dto.post.request.CommentWriteRequest;
import com.linker.backend.dto.post.request.FeedSeenRequest;
import com.linker.backend.dto.post.request.PinPostsRequest;
import com.linker.backend.dto.post.request.PostPeriodRequest;
import com.linker.backend.dto.post.request.PostPhotoRequest;
import com.linker.backend.dto.post.request.PostWriteRequest;
import com.linker.backend.dto.post.response.CommentResponse;
import com.linker.backend.dto.post.response.PinnedPostsResponse;
import com.linker.backend.dto.post.response.EditorRepoListResponse;
import com.linker.backend.dto.post.response.EditorRepoResponse;
import com.linker.backend.dto.post.response.LikeCountResponse;
import com.linker.backend.dto.post.response.LikerItemResponse;
import com.linker.backend.dto.post.response.LikerListResponse;
import com.linker.backend.dto.post.response.PostEditFormResponse;
import com.linker.backend.dto.post.response.PostIdResponse;
import com.linker.backend.dto.post.response.PostPeriodResponse;
import com.linker.backend.dto.post.response.PostPhotoResponse;
import com.linker.backend.dto.post.response.RecommendedUserItemResponse;
import com.linker.backend.dto.post.response.RecommendedUsersResponse;
import com.linker.backend.dto.post.response.RepoSummaryResponse;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.file.UploadedFile;
import com.linker.backend.entity.github.GithubRepo;
import com.linker.backend.entity.notification.type.NotificationTypes;
import com.linker.backend.entity.post.Comment;
import com.linker.backend.entity.post.FeedSeenPost;
import com.linker.backend.entity.post.PinnedPost;
import com.linker.backend.entity.post.Post;
import com.linker.backend.entity.post.PostDemoLink;
import com.linker.backend.entity.post.PostImage;
import com.linker.backend.entity.post.PostLike;
import com.linker.backend.entity.post.PostTag;
import com.linker.backend.entity.post.type.PostVisibility;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.github.GithubRepoSource;
import com.linker.backend.integration.github.GithubTeamSource;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.github.GithubRepoRepository;
import com.linker.backend.repository.moderation.UserBlockRepository;
import com.linker.backend.repository.post.CommentRepository;
import com.linker.backend.repository.post.FeedSeenPostRepository;
import com.linker.backend.repository.post.PinnedPostRepository;
import com.linker.backend.repository.post.PostLikeRepository;
import com.linker.backend.repository.post.PostRepository;
import com.linker.backend.repository.profile.FollowRepository;
import com.linker.backend.repository.profile.UserTechTagRepository;
import com.linker.backend.repository.team.TeamRepository;
import com.linker.backend.dto.recruit.mapper.RecruitCardMapper;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service("userPostService")
public class PostService {

	private static final Logger log = LoggerFactory.getLogger(PostService.class);
	private static final String UNAVAILABLE = "삭제되었거나 볼 수 없는 콘텐츠예요";
	private static final String DELETED_COMMENT = "삭제된 댓글입니다";

	private final GithubRepoRepository repos;
	private final PostRepository posts;
	private final UserRepository users;
	private final UploadService uploads;
	private final PostLikeRepository likes;
	private final CommentRepository comments;
	private final FeedSeenPostRepository seenPosts;
	private final PinnedPostRepository pins;
	private final UserBlockRepository blocks;
	private final NotificationService notifications;
	private final RecruitCardMapper authors;
	private final ProMembership pro;
	private final TeamRepository teams;
	/** GitHub HTTP runs outside DB transactions, so the repo list uses explicit templates */
	private final GithubRepoSource github;
	private final UserTechTagRepository userTechTags;
	private final FollowRepository follows;
	private final TransactionTemplate write;
	private final TransactionTemplate read;
	private final Clock clock;

	public PostService(
			GithubRepoRepository repos,
			PostRepository posts,
			UserRepository users,
			UploadService uploads,
			PostLikeRepository likes,
			CommentRepository comments,
			FeedSeenPostRepository seenPosts,
			PinnedPostRepository pins,
			UserBlockRepository blocks,
			NotificationService notifications,
			RecruitCardMapper authors,
			ProMembership pro,
			TeamRepository teams,
			GithubRepoSource github,
			UserTechTagRepository userTechTags,
			FollowRepository follows,
			PlatformTransactionManager transactions,
			Clock clock
	) {
		this.repos = repos;
		this.posts = posts;
		this.users = users;
		this.uploads = uploads;
		this.likes = likes;
		this.seenPosts = seenPosts;
		this.pins = pins;
		this.comments = comments;
		this.blocks = blocks;
		this.notifications = notifications;
		this.authors = authors;
		this.pro = pro;
		this.teams = teams;
		this.github = github;
		this.userTechTags = userTechTags;
		this.follows = follows;
		this.clock = clock;
		this.write = new TransactionTemplate(transactions);
		this.read = new TransactionTemplate(transactions);
		this.read.setReadOnly(true);
	}

	@Transactional
	public PinnedPostsResponse replacePins(AuthenticatedUser user, PinPostsRequest request) {
		User owner = users.findById(user.userId())
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));
		List<Long> requested = postIds(request);
		List<Long> current = pins.findPostIds(owner.getId());
		boolean addsNew = requested.stream().anyMatch(id -> !current.contains(id));
		int cap = pro.active(owner.getId(), clock.instant())
				? PlanLimits.PINNED_POSTS_PRO
				: PlanLimits.PINNED_POSTS_FREE;
		if (requested.size() > PlanLimits.PINNED_POSTS_PRO || (addsNew && requested.size() > cap)) {
			throw new ApiException(403, "PLAN_LIMIT", pinLimitMessage(cap));
		}
		List<Post> owned = new ArrayList<>();
		for (Long postId : requested) {
			Post post = requireOwnedPost(owner.getId(), postId);
			if (post.getVisibility() != PostVisibility.VISIBLE) {
				throw new ApiException(404, "NOT_FOUND", UNAVAILABLE);
			}
			owned.add(post);
		}
		pins.deleteByUserId(owner.getId());
		for (int i = 0; i < owned.size(); i++) {
			pins.save(PinnedPost.create(owner, owned.get(i), i));
		}
		return new PinnedPostsResponse(List.copyOf(requested));
	}

	@Transactional
	public void markSeen(AuthenticatedUser user, FeedSeenRequest request) {
		if (request == null || request.postIds() == null || request.postIds().isEmpty()) {
			return;
		}
		User viewer = users.findById(user.userId())
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));
		Instant now = clock.instant();
		Set<Long> unique = new HashSet<>();
		for (Long postId : request.postIds()) {
			if (postId == null || postId <= 0 || !unique.add(postId)) {
				continue;
			}
			Post post = posts.findById(postId).orElse(null);
			if (post == null || post.getDeletedAt() != null) {
				continue;
			}
			var existing = seenPosts.findByUserIdAndPostId(user.userId(), postId);
			if (existing.isPresent()) {
				existing.get().touchSeenAt(now);
			} else {
				seenPosts.save(FeedSeenPost.of(viewer, post, now));
			}
		}
	}

	/**
	 * Empty "추천" (Policy ch. 4 exceptions): up to 5 active developers who share my tech stack, the most
	 * shared tags first. People I already follow or have a block with either way are left out. Without
	 * a tech stack there is nothing to match, so the list is empty and the screen shows only the copy.
	 */
	@Transactional(readOnly = true)
	public RecommendedUsersResponse recommendedUsers(AuthenticatedUser user) {
		List<String> myTags = userTechTags.findSelected(user.userId()).stream()
				.map(com.linker.backend.entity.profile.UserTechTag::tagName)
				.toList();
		if (myTags.isEmpty()) {
			return new RecommendedUsersResponse(List.of());
		}
		Set<Long> skip = new HashSet<>(follows.findAllFollowedIds(user.userId()));
		skip.addAll(blocks.findActiveBlockedIds(user.userId()));
		skip.addAll(blocks.findActiveBlockerIds(user.userId()));
		List<Long> picked = userTechTags.findDevelopersSharingTags(user.userId(), myTags).stream()
				.filter(id -> !skip.contains(id))
				.limit(PlanLimits.FEED_RECOMMENDED_USERS)
				.toList();
		if (picked.isEmpty()) {
			return new RecommendedUsersResponse(List.of());
		}
		Map<Long, User> people = new HashMap<>();
		for (User person : users.findAllById(picked)) {
			people.put(person.getId(), person);
		}
		Map<Long, List<String>> stacks = new HashMap<>();
		for (Object[] row : userTechTags.findTagNamesByUserIds(picked)) {
			stacks.computeIfAbsent(((Number) row[0]).longValue(), id -> new ArrayList<>()).add((String) row[1]);
		}
		List<RecommendedUserItemResponse> items = picked.stream()
				.map(people::get)
				.filter(Objects::nonNull)
				.map(person -> new RecommendedUserItemResponse(
						authors.toAuthor(person),
						List.copyOf(stacks.getOrDefault(person.getId(), List.of()))))
				.toList();
		return new RecommendedUsersResponse(items);
	}

	/**
	 * Step 1 list (POL-P-1). The unfiltered personal list first pulls my own public repos (forks included)
	 * from GitHub into the shared repo cache, so repos never linked to a team can be posted too. Search
	 * and the team list read that cache. If GitHub fails, the cache is shown as it is (04 ch. 2).
	 */
	public EditorRepoListResponse listRepos(AuthenticatedUser user, String q, Long teamId) {
		String query = blankToNull(q);
		if (teamId == null && query == null) {
			List<Long> synced = syncOwnedPublicRepos(user);
			if (synced != null) {
				return read.execute(status -> toEditorRepos(user, ownedSelectable(user, synced), null));
			}
		}
		return read.execute(status -> toEditorRepos(user, cachedRepos(user, query, teamId), teamId));
	}

	/** Upserted `github_repos` ids of my public repos, or null when GitHub couldn't be read */
	private List<Long> syncOwnedPublicRepos(AuthenticatedUser user) {
		List<GithubTeamSource.Repository> fetched;
		try {
			fetched = github.ownedPublicRepositories(user.userId(), user.login());
		}
		catch (ApiException exception) {
			if ("LOGIN_REQUIRED".equals(exception.getCode())) {
				throw exception;
			}
			// The list still works from the cache; the log shows when the sync itself keeps failing
			log.warn("post editor repo sync failed: user={} status={} code={}",
					user.userId(), exception.getStatus(), exception.getCode());
			return null;
		}
		if (fetched.isEmpty()) {
			return List.of();
		}
		Instant now = clock.instant();
		// Shared upsert by GitHub repo id (ON CONFLICT … RETURNING), the same one 08/09 use for team repos
		return write.execute(status -> fetched.stream().map(repo -> teams.cacheRepo(repo, now)).toList());
	}

	/** The synced rows, still public and mine, by name like the cache query */
	private List<GithubRepo> ownedSelectable(AuthenticatedUser user, List<Long> ids) {
		if (ids.isEmpty()) {
			return List.of();
		}
		return repos.findAllById(ids).stream()
				.filter(GithubRepo::isSelectable)
				.filter(repo -> repo.getOwnerLogin().equalsIgnoreCase(user.login()))
				.sorted(Comparator.comparing(GithubRepo::getFullName, String.CASE_INSENSITIVE_ORDER))
				.toList();
	}

	private List<GithubRepo> cachedRepos(AuthenticatedUser user, String query, Long teamId) {
		List<GithubRepo> rows;
		if (teamId != null) {
			// Linked team repos (POL-P-1 / WBS 441). Caller must be able to open the team elsewhere.
			List<Long> linkedIds = teams.findLinkedRepos(teamId).stream()
					.map(com.linker.backend.dto.team.response.TeamConnectionView.LinkedRepo::repoId)
					.toList();
			if (linkedIds.isEmpty()) {
				return List.of();
			}
			rows = repos.findAllById(linkedIds).stream()
					.filter(repo -> repo.getDeletedAt() == null && !repo.isPrivate())
					.filter(repo -> query == null || repo.getFullName().toLowerCase(Locale.ROOT)
							.contains(query.toLowerCase(Locale.ROOT)))
					.sorted(Comparator.comparing(GithubRepo::getFullName, String.CASE_INSENSITIVE_ORDER))
					.toList();
		}
		else {
			// Split null-q vs search-q: Postgres + Hibernate bind null string params as bytea in `lower(:q)`.
			rows = query == null
					? repos.findPublicByOwner(user.login())
					: repos.findPublicByOwnerAndQuery(user.login(), query);
		}
		return rows;
	}

	private EditorRepoListResponse toEditorRepos(AuthenticatedUser user, List<GithubRepo> rows, Long teamId) {
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
						teamId,
						posted.contains(repo.getId())
				))
				.toList();
		return new EditorRepoListResponse(items);
	}

	@Transactional(readOnly = true)
	public RepoSummaryResponse repoSummary(AuthenticatedUser user, long repoId) {
		GithubRepo repo = requireOwnedSelectableRepo(user, repoId);
		return toSummary(repo, 0, 0, photoCap(user.userId()));
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
		// Row lock: two publishes at once can't both slip under the daily limit
		User author = users.lockById(user.userId())
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));
		enforceDailyPostLimit(user.userId());
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
		int photoCap = photoCap(user.userId());
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
		List<String> tags = post.getTags().stream().map(PostTag::getName).toList();
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
				toSummary(post.getRepo(), post.getMyCommitCount(), post.getLinkerIssueCount(), photoCap),
				photoCap
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
		// An edit sends the kept photos and tags back as-is. Hibernate flushes new child rows before
		// it deletes the orphaned old ones, so re-adding the same file or tag would hit
		// post_images_post_file_uk / post_tags_post_tag_uk. Delete the old rows first, then add.
		post.replaceImages(List.of());
		post.replaceDemoLinks(List.of());
		post.replaceTags(List.of());
		posts.flush();
		post.replaceImages(content.images());
		post.replaceDemoLinks(content.demoLinks());
		post.replaceTags(content.tags());
		return new PostIdResponse(post.getId());
	}

	@Transactional
	public LikeCountResponse like(AuthenticatedUser user, long postId) {
		Post post = requireReadablePost(user, postId);
		rejectUnlessVisible(post);
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
		Post post = requireReadablePost(user, postId);
		rejectUnlessVisible(post);
		String text = requireCommentText(request == null ? null : request.text());
		// Row lock: comments sent at once can't both slip under the limits
		User author = users.lockById(user.userId())
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));
		enforceCommentLimits(user.userId());
		Comment comment = comments.save(Comment.write(post, author, null, text));
		post.increaseCommentCount();
		notifyComment(post, null, user.userId(), comment.getId());
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
		eraseComment(comment, post, clock.instant());
	}

	/** Page 06 withdrawal batch. Deletes this member's posts and comments. */
	@Transactional
	public void deleteAuthoredContent(long userId, Instant now) {
		List<Comment> authored = new ArrayList<>(comments.findByAuthorId(userId));
		for (Comment comment : authored) {
			Post post = comment.getPost();
			if (comment.isDeleted() || post.getAuthor().getId() == userId) {
				continue;
			}
			eraseComment(comment, post, now);
		}
		for (Post post : posts.findByAuthor_Id(userId)) {
			if (post.getDeletedAt() != null) {
				continue;
			}
			for (Comment comment : comments.findByPostIdOrderByIdAsc(post.getId())) {
				if (!comment.isDeleted()) {
					comment.softDelete(now);
				}
			}
			likes.deleteByPostId(post.getId());
			post.softDelete(now);
		}
	}

	private void eraseComment(Comment comment, Post post, Instant now) {
		comments.delete(comment);
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

	/**
	 * Policy ch. 2 "Write post 10/day": only posts actually published count, so a request rejected for
	 * any reason (validation, repo already posted, …) leaves the quota alone. Deleted posts still count.
	 */
	private void enforceDailyPostLimit(long userId) {
		Instant now = clock.instant();
		List<Instant> recent = posts.findCreatedAtSince(
				userId, now.minusSeconds(PlanLimits.POSTS_PER_DAY_WINDOW_SECONDS));
		if (recent.size() < PlanLimits.POSTS_PER_DAY) {
			return;
		}
		Instant freed = recent.get(recent.size() - PlanLimits.POSTS_PER_DAY)
				.plusSeconds(PlanLimits.POSTS_PER_DAY_WINDOW_SECONDS);
		long retryAfter = Math.max(1, freed.getEpochSecond() - now.getEpochSecond());
		throw new ApiException(
				429,
				"RATE_LIMITED",
				"오늘은 더 할 수 없어요. 내일 다시 시도해 주세요.",
				Map.of("retryAfterSeconds", retryAfter)
		);
	}

	private ValidatedContent validateContent(PostWriteRequest request, long userId) {
		if (request == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "게시물 내용을 확인해 주세요");
		}
		rejectEmoji(request.intro(), request.body(), request.myRole());
		String intro = requireText(request.intro(), PlanLimits.POST_INTRO_MIN, PlanLimits.POST_INTRO_MAX, "한 줄 소개를 확인해 주세요");
		String body = request.body() == null ? "" : request.body().trim();
		if (chars(body) > PlanLimits.POST_BODY_MAX) {
			throw new ApiException(400, "VALIDATION_ERROR", "본문은 2,000자까지예요");
		}
		String myRole = blankToNull(request.myRole());
		if (myRole != null && chars(myRole) > PlanLimits.POST_ROLE_MAX) {
			throw new ApiException(400, "VALIDATION_ERROR", "역할을 확인해 주세요");
		}
		List<PostDemoLink> demoLinks = normalizeDemoLinks(request.demoLinks());
		PeriodDates period = parsePeriod(request.period());
		Integer teamSize = request.teamSize();
		if (teamSize != null && teamSize > PlanLimits.POST_TEAM_SIZE_MAX) {
			throw new ApiException(400, "VALIDATION_ERROR",
					PlanLimits.POST_TEAM_SIZE_MAX + "명 이상은 팀 구축 후 결제를 통해 인원을 늘릴 수 있습니다");
		}
		if (teamSize != null && teamSize < PlanLimits.POST_TEAM_SIZE_MIN) {
			throw new ApiException(400, "VALIDATION_ERROR", "팀 규모를 확인해 주세요");
		}
		List<PostTag> tags = toPostTags(normalizeTags(request.tags()));
		List<PostImage> images = toPostImages(request.photos(), userId);
		return new ValidatedContent(
				intro, body, myRole, period.start(), period.end(), teamSize, images, demoLinks, tags);
	}

	private List<PostImage> toPostImages(List<PostPhotoRequest> photos, long userId) {
		// POL-P-2: at least one photo; the first is the cover (and the OG image on 23)
		if (photos == null || photos.isEmpty()) {
			throw new ApiException(400, "VALIDATION_ERROR", "사진을 1장 이상 올려 주세요.");
		}
		int cap = photoCap(userId);
		if (photos.size() > cap) {
			throw new ApiException(
					403,
					"PLAN_LIMIT",
					cap >= PlanLimits.POST_PHOTOS_PRO
							? "사진은 " + cap + "장까지 올릴 수 있어요."
							: "사진은 5장까지 올릴 수 있어요. Pro로 10장까지 늘릴 수 있어요.",
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
		if (normalized.stream().anyMatch(tag -> chars(tag) > PlanLimits.POST_TAG_MAX_LENGTH)) {
			throw new ApiException(400, "VALIDATION_ERROR",
					"태그는 " + PlanLimits.POST_TAG_MAX_LENGTH + "자까지 쓸 수 있어요");
		}
		return normalized;
	}

	/** POL-P-2: post tags are free text, kept as typed (already trimmed, deduplicated and capped) */
	private List<PostTag> toPostTags(List<String> names) {
		return names.stream().map(PostTag::of).toList();
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

	private List<Long> postIds(PinPostsRequest request) {
		if (request == null || request.postIds() == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		}
		List<Long> ids = new ArrayList<>();
		for (Long id : request.postIds()) {
			if (id == null || id <= 0 || ids.contains(id)) {
				throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
			}
			ids.add(id);
		}
		return ids;
	}

	private String pinLimitMessage(int cap) {
		if (cap >= PlanLimits.PINNED_POSTS_PRO) {
			return "대표 작업물은 " + cap + "개까지 고정할 수 있어요";
		}
		return "대표 작업물은 " + cap + "개까지 고정할 수 있어요. Pro로 "
				+ PlanLimits.PINNED_POSTS_PRO + "개까지 늘릴 수 있어요";
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

	/**
	 * Policy ch. 2 "Write comment 10/min, 300/day": only comments actually written count, so a rejected
	 * request (empty, too long, hidden post, …) leaves the quota alone. Deleted comments still count.
	 */
	private void enforceCommentLimits(long userId) {
		Instant now = clock.instant();
		List<Instant> today = comments.findCreatedAtSince(
				userId, now.minusSeconds(PlanLimits.POST_COMMENTS_PER_DAY_WINDOW_SECONDS));
		if (today.size() >= PlanLimits.POST_COMMENTS_PER_DAY) {
			throw commentLimit(today, PlanLimits.POST_COMMENTS_PER_DAY,
					PlanLimits.POST_COMMENTS_PER_DAY_WINDOW_SECONDS, now, "오늘은 더 할 수 없어요. 내일 다시 시도해 주세요.");
		}
		Instant minuteStart = now.minusSeconds(PlanLimits.POST_COMMENTS_PER_MINUTE_WINDOW_SECONDS);
		List<Instant> lastMinute = today.stream().filter(at -> at.isAfter(minuteStart)).toList();
		if (lastMinute.size() >= PlanLimits.POST_COMMENTS_PER_MINUTE) {
			throw commentLimit(lastMinute, PlanLimits.POST_COMMENTS_PER_MINUTE,
					PlanLimits.POST_COMMENTS_PER_MINUTE_WINDOW_SECONDS, now, "잠시 후 다시 시도해 주세요.");
		}
	}

	private static ApiException commentLimit(List<Instant> recent, int permits, int windowSeconds, Instant now,
			String message) {
		Instant freed = recent.get(recent.size() - permits).plusSeconds(windowSeconds);
		return new ApiException(429, "RATE_LIMITED", message,
				Map.of("retryAfterSeconds", Math.max(1, freed.getEpochSecond() - now.getEpochSecond())));
	}

	/** Policy ch. 4 exceptions: a post hidden by reports takes no new likes or comments, even from its author */
	private static void rejectUnlessVisible(Post post) {
		if (post.getVisibility() != PostVisibility.VISIBLE) {
			throw new ApiException(409, "STATE_CONFLICT", "검토 중인 게시물에는 좋아요와 댓글을 남길 수 없어요.");
		}
	}

	private String requireCommentText(String raw) {
		if (raw == null || raw.isBlank()) {
			throw new ApiException(400, "EMPTY", "내용을 입력해 주세요");
		}
		String text = raw.trim();
		if (graphemes(text) > PlanLimits.POST_COMMENT_MAX) {
			throw new ApiException(400, "TOO_LONG", "500자까지 쓸 수 있어요");
		}
		return text;
	}

	/**
	 * Policy ch. 2: every character as the reader sees it is 1, emoji included (FE `countChars` uses
	 * `Intl.Segmenter` graphemes). Comments take emoji, so code points alone would over-count them.
	 */
	private static int graphemes(String text) {
		BreakIterator characters = BreakIterator.getCharacterInstance(Locale.ROOT);
		characters.setText(text);
		int count = 0;
		while (characters.next() != BreakIterator.DONE) {
			count++;
		}
		return count;
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

	/** Policy ch. 11: Pro 10 photos per post. After Pro ends, saved photos stay; new writes and edits use 5. */
	private int photoCap(long userId) {
		return pro.active(userId, clock.instant()) ? PlanLimits.POST_PHOTOS_PRO : PlanLimits.POST_PHOTOS_FREE;
	}

	private RepoSummaryResponse toSummary(GithubRepo repo, int commitCount, int issueCount, int maxPhotos) {
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
				maxPhotos
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
		if (chars(value) < min || chars(value) > max) {
			throw new ApiException(400, "VALIDATION_ERROR", message);
		}
		return value;
	}

	/** Policy ch. 2 character count (code points, so a character outside the BMP is still 1) */
	private static int chars(String value) {
		return value.codePointCount(0, value.length());
	}

	/** POL-P-2: post text takes no emoji. Same code points as 20 (`RecruitmentService`) and FE `hasEmoji`. */
	private static void rejectEmoji(String... values) {
		for (String value : values) {
			if (value != null && value.codePoints().anyMatch(PostService::isEmojiCodePoint)) {
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
