package com.linker.backend.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.function.ToLongFunction;

import com.linker.backend.dto.post.response.CommentListResponse;
import com.linker.backend.dto.post.response.CommentResponse;
import com.linker.backend.dto.post.response.FeedPostItemResponse;
import com.linker.backend.dto.post.response.PostCardListResponse;
import com.linker.backend.dto.post.response.PostCardResponse;
import com.linker.backend.dto.post.response.PostDetailResponse;
import com.linker.backend.dto.post.response.PostPeriodResponse;
import com.linker.backend.dto.post.response.PostReadmeResponse;
import com.linker.backend.dto.post.response.PostRepoCardResponse;
import com.linker.backend.dto.recruit.response.CursorPage;
import com.linker.backend.entity.account.type.JobSeekingStatus;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.post.Comment;
import com.linker.backend.entity.post.Post;
import com.linker.backend.entity.post.PostDemoLink;
import com.linker.backend.entity.post.PostTag;
import com.linker.backend.entity.post.PostView;
import com.linker.backend.entity.post.type.PostViewSource;
import com.linker.backend.entity.post.type.PostVisibility;
import com.linker.backend.entity.profile.UserTechTag;
import com.linker.backend.entity.profile.type.JobCategory;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.CurrentUser;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.moderation.UserBlockRepository;
import com.linker.backend.repository.post.CommentRepository;
import com.linker.backend.repository.post.FeedSeenPostRepository;
import com.linker.backend.repository.post.PinnedPostRepository;
import com.linker.backend.repository.post.PostLikeRepository;
import com.linker.backend.repository.post.PostRepository;
import com.linker.backend.repository.post.PostViewRepository;
import com.linker.backend.repository.profile.FollowRepository;
import com.linker.backend.repository.profile.UserJobCategoryRepository;
import com.linker.backend.repository.profile.UserTechTagRepository;
import com.linker.backend.dto.recruit.mapper.RecruitCardMapper;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PostService {

	private static final String UNAVAILABLE = "삭제되었거나 볼 수 없는 콘텐츠예요";
	private static final String DELETED_COMMENT = "삭제된 댓글입니다";
	private static final String TAB_RECOMMENDED = "recommended";
	private static final String TAB_FOLLOWING = "following";
	private static final String WHY_TECH_STACK = " 쓰는 사람들의 인기 글";
	private static final String WHY_JOB_CATEGORY = " 직군의 인기 글";
	private static final Comparator<ScoredPost> BY_POPULARITY = Comparator
			.comparingDouble(ScoredPost::score).reversed()
			.thenComparing(row -> row.post().getCreatedAt(), Comparator.reverseOrder())
			.thenComparing(row -> row.post().getId(), Comparator.reverseOrder());

	private final PostRepository posts;
	private final CommentRepository comments;
	private final PostLikeRepository likes;
	private final PostViewRepository views;
	private final FeedSeenPostRepository seenPosts;
	private final PinnedPostRepository pins;
	private final UserRepository users;
	private final UserBlockRepository blocks;
	private final RecruitCardMapper authors;
	private final FollowRepository follows;
	private final UserTechTagRepository techTags;
	private final UserJobCategoryRepository jobCategories;
	private final Clock clock;

	public PostService(
			PostRepository posts,
			CommentRepository comments,
			PostLikeRepository likes,
			PostViewRepository views,
			FeedSeenPostRepository seenPosts,
			PinnedPostRepository pins,
			UserRepository users,
			UserBlockRepository blocks,
			RecruitCardMapper authors,
			FollowRepository follows,
			UserTechTagRepository techTags,
			UserJobCategoryRepository jobCategories,
			Clock clock
	) {
		this.posts = posts;
		this.comments = comments;
		this.likes = likes;
		this.views = views;
		this.seenPosts = seenPosts;
		this.pins = pins;
		this.users = users;
		this.blocks = blocks;
		this.authors = authors;
		this.follows = follows;
		this.techTags = techTags;
		this.jobCategories = jobCategories;
		this.clock = clock;
	}

	/**
	 * Page 24 home feed (POL-P-4). {@code tab=following} lists posts by people the viewer follows,
	 * newest first. Otherwise "추천": developers and operators get posts matching their tech stack or
	 * job categories first, then the rest shuffled; guests and recruiters get a shuffled list.
	 * The cursor is {@code <sessionStartMillis>.<offset>}: the session start seeds the shuffle and
	 * drops posts written or first seen after it, so scrolling neither repeats nor skips a post.
	 */
	@Transactional(readOnly = true)
	public CursorPage<FeedPostItemResponse> feed(String tab, String cursor, Boolean offersOnly) {
		AuthenticatedUser viewer = CurrentUser.optional().orElse(null);
		boolean followingTab = isFollowingTab(tab);
		FeedCursor position = FeedCursor.parse(cursor, clock.instant());
		boolean onlyOffers = !followingTab && Boolean.TRUE.equals(offersOnly);

		List<Post> candidates = new ArrayList<>();
		for (Post post : filterCandidates(posts.findVisibleForFeed(), viewer, onlyOffers)) {
			if (!post.getCreatedAt().isAfter(position.startedAt())) {
				candidates.add(post);
			}
		}

		List<ScoredPost> ordered;
		if (followingTab) {
			ordered = followingFeed(viewer, candidates);
		} else if (viewer == null || viewer.userType() == UserType.RECRUITER) {
			ordered = limitConsecutiveAuthors(shuffled(candidates, position.seed()));
		} else {
			ordered = limitConsecutiveAuthors(matchedFeed(viewer, candidates, position));
		}

		int from = Math.min(position.offset(), ordered.size());
		int to = Math.min(from + PlanLimits.FEED_PAGE_SIZE, ordered.size());
		List<FeedPostItemResponse> items = new ArrayList<>(to - from);
		for (ScoredPost row : ordered.subList(from, to)) {
			Post post = row.post();
			post.getImages().size();
			post.getTags().size();
			items.add(FeedPostItemResponse.of(toCard(post), row.whyShown()));
		}
		String next = to < ordered.size() ? position.at(to) : null;
		return new CursorPage<>(items, next);
	}

	@Transactional
	public PostDetailResponse detail(long postId, String from) {
		AuthenticatedUser viewer = CurrentUser.optional().orElse(null);
		Post post = loadReadable(postId, viewer);
		post.getImages().size();
		post.getDemoLinks().size();
		post.getTags().size();

		boolean isAuthor = viewer != null && viewer.userId() == post.getAuthor().getId();
		boolean likedByMe = viewer != null && likes.existsByPostIdAndUserId(postId, viewer.userId());
		PostViewSource source = resolveSource(from);
		if (viewer != null && !isAuthor) {
			recordView(post, viewer.userId(), source);
		}

		boolean canSendOffer = viewer != null && viewer.userType() == UserType.RECRUITER;
		boolean repoAvailable = isRepoAvailable(post);
		return new PostDetailResponse(
				post.getId(),
				authors.toAuthor(post.getAuthor()),
				post.getSummary(),
				post.getBody(),
				toRepoCard(post, repoAvailable),
				post.getImages().stream().map(image -> image.getFile().getUrl() == null ? "" : image.getFile().getUrl()).toList(),
				post.getMyRole(),
				post.getDemoLinks().stream().map(PostDemoLink::getUrl).toList(),
				toPeriod(post),
				post.getTeamSize(),
				post.getTags().stream().map(tag -> tag.getTag().getName()).toList(),
				post.getLikeCount(),
				post.getCommentCount(),
				post.getViewCount(),
				post.getVisibility().name(),
				iso(post.getCreatedAt()),
				post.getEditedAt() == null ? null : iso(post.getEditedAt()),
				isAuthor,
				likedByMe,
				trafficLabel(source, from),
				canSendOffer,
				repoAvailable
		);
	}

	@Transactional(readOnly = true)
	public CommentListResponse comments(long postId) {
		AuthenticatedUser viewer = CurrentUser.optional().orElse(null);
		loadReadable(postId, viewer);
		List<CommentResponse> items = comments.findByPostIdOrderByIdAsc(postId).stream()
				.filter(row -> !row.isDeleted())
				.map(this::toComment)
				.toList();
		return new CommentListResponse(items);
	}

	/** Profile post list (page 04). Pinned posts come first, in saved order. */
	@Transactional(readOnly = true)
	public PostCardListResponse profilePosts(String login) {
		AuthenticatedUser viewer = CurrentUser.optional().orElse(null);
		if (login == null || login.isBlank()) {
			throw new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요");
		}
		User author = users.findByUsername(login.trim())
				.filter(user -> user.getStatus() != UserStatus.DELETED && user.getDeletedAt() == null)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));
		if (viewer != null && viewer.userId() != author.getId() && blocked(viewer.userId(), author.getId())) {
			throw new ApiException(404, "NOT_FOUND", "볼 수 없는 프로필");
		}
		if (author.getUserType() != UserType.DEVELOPER) {
			return new PostCardListResponse(List.of());
		}
		List<PostCardResponse> items = new ArrayList<>();
		for (Post post : posts.findVisibleByAuthorId(author.getId())) {
			post.getImages().size();
			post.getTags().size();
			items.add(toCard(post));
		}
		List<Long> pinnedIds = pins.findVisiblePostIds(author.getId());
		Map<Long, Integer> pinOrder = new HashMap<>();
		for (int i = 0; i < pinnedIds.size(); i++) {
			pinOrder.put(pinnedIds.get(i), i);
		}
		items.sort(Comparator.comparingInt(card -> pinOrder.getOrDefault(card.id(), Integer.MAX_VALUE)));
		return new PostCardListResponse(items);
	}

	@Transactional(readOnly = true)
	public PostCardListResponse sameRepoPosts(long postId) {
		AuthenticatedUser viewer = CurrentUser.optional().orElse(null);
		Post post = loadReadable(postId, viewer);
		List<PostCardResponse> items = new ArrayList<>();
		for (Post other : posts.findSameRepoVisible(post.getRepo().getId(), postId)) {
			if (viewer != null && blocked(viewer.userId(), other.getAuthor().getId())) {
				continue;
			}
			other.getImages().size();
			other.getTags().size();
			items.add(toCard(other));
		}
		return new PostCardListResponse(items);
	}

	/**
	 * Included: stub until GitHub README cache lands. Does not block Required APIs.
	 */
	@Transactional(readOnly = true)
	public PostReadmeResponse readme(long postId) {
		AuthenticatedUser viewer = CurrentUser.optional().orElse(null);
		Post post = loadReadable(postId, viewer);
		if (!isRepoAvailable(post)) {
			throw new ApiException(404, "NOT_FOUND", "레포를 볼 수 없음");
		}
		throw new ApiException(501, "NOT_IMPLEMENTED", "README는 아직 준비 중이에요");
	}

	private List<Post> filterCandidates(List<Post> rows, AuthenticatedUser viewer, boolean offersOnly) {
		Set<Long> blocked = blockedAuthorIds(viewer);
		List<Post> out = new ArrayList<>();
		for (Post post : rows) {
			long authorId = post.getAuthor().getId();
			if (blocked.contains(authorId)) {
				continue;
			}
			if (offersOnly && post.getAuthor().getJobSeekingStatus() == JobSeekingStatus.OFF) {
				continue;
			}
			out.add(post);
		}
		return out;
	}

	private Set<Long> blockedAuthorIds(AuthenticatedUser viewer) {
		if (viewer == null) {
			return Set.of();
		}
		Set<Long> blocked = new HashSet<>();
		blocked.addAll(blocks.findActiveBlockedIds(viewer.userId()));
		blocked.addAll(blocks.findActiveBlockerIds(viewer.userId()));
		return blocked;
	}

	private static boolean isFollowingTab(String tab) {
		if (tab == null || tab.isBlank() || TAB_RECOMMENDED.equals(tab.trim())) {
			return false;
		}
		if (TAB_FOLLOWING.equals(tab.trim())) {
			return true;
		}
		throw new ApiException(400, "VALIDATION_ERROR", "탭을 확인해 주세요");
	}

	/** "팔로잉": followed authors only, newest first (query order). Guests and recruiters follow nobody. */
	private List<ScoredPost> followingFeed(AuthenticatedUser viewer, List<Post> candidates) {
		if (viewer == null) {
			return List.of();
		}
		Set<Long> followed = new HashSet<>(follows.findAllFollowedIds(viewer.userId()));
		if (followed.isEmpty()) {
			return List.of();
		}
		List<ScoredPost> rows = new ArrayList<>();
		for (Post post : candidates) {
			if (followed.contains(post.getAuthor().getId())) {
				rows.add(new ScoredPost(post, 0, null));
			}
		}
		return rows;
	}

	/**
	 * "추천" for developers and operators: unseen posts that share my tech stack tag or whose author picked
	 * one of my job categories, by popularity; then the other unseen posts shuffled; then posts already
	 * seen before this session, shuffled. Own posts are left out.
	 */
	private List<ScoredPost> matchedFeed(AuthenticatedUser viewer, List<Post> candidates, FeedCursor position) {
		List<Post> pool = new ArrayList<>();
		for (Post post : candidates) {
			if (post.getAuthor().getId() != viewer.userId()) {
				pool.add(post);
			}
		}
		Set<Long> seen = new HashSet<>(seenPosts.findPostIdsSeenBefore(viewer.userId(), position.startedAt()));
		List<String> myTags = techTags.findSelected(viewer.userId()).stream().map(UserTechTag::tagName).toList();
		List<JobCategory> myCategories = jobCategories.findByUser_IdOrderByIdAsc(viewer.userId()).stream()
				.map(row -> JobCategory.valueOf(row.key()))
				.toList();
		Map<Long, Set<JobCategory>> authorCategories = myCategories.isEmpty() ? Map.of() : authorCategories(pool);
		Instant now = position.startedAt();
		Instant matureBefore = now.minus(PlanLimits.FEED_NEW_ACCOUNT_LIKE_EXCLUSION_DAYS, ChronoUnit.DAYS);
		Map<Long, Double> scores = popularityScores(pool, matureBefore, now);

		List<ScoredPost> matched = new ArrayList<>();
		List<Post> unmatched = new ArrayList<>();
		List<Post> alreadySeen = new ArrayList<>();
		for (Post post : pool) {
			if (seen.contains(post.getId())) {
				alreadySeen.add(post);
				continue;
			}
			String why = matchReason(post, myTags, myCategories, authorCategories);
			if (why == null) {
				unmatched.add(post);
			} else {
				matched.add(new ScoredPost(post, scores.getOrDefault(post.getId(), 0.0), why));
			}
		}
		matched.sort(BY_POPULARITY);
		List<ScoredPost> ordered = new ArrayList<>(pool.size());
		ordered.addAll(matched);
		ordered.addAll(shuffled(unmatched, position.seed()));
		ordered.addAll(shuffled(alreadySeen, position.seed()));
		return ordered;
	}

	/** "Why shown": a shared tech stack tag (in my order) beats a shared job category. */
	private static String matchReason(
			Post post,
			List<String> myTags,
			List<JobCategory> myCategories,
			Map<Long, Set<JobCategory>> authorCategories
	) {
		if (!myTags.isEmpty()) {
			Set<String> postTags = new HashSet<>();
			for (PostTag tag : post.getTags()) {
				postTags.add(tag.getTag().getName());
			}
			for (String tag : myTags) {
				if (postTags.contains(tag)) {
					return withObjectParticle(tag) + WHY_TECH_STACK;
				}
			}
		}
		Set<JobCategory> theirs = authorCategories.getOrDefault(post.getAuthor().getId(), Set.of());
		for (JobCategory category : myCategories) {
			if (theirs.contains(category)) {
				return category.label() + WHY_JOB_CATEGORY;
			}
		}
		return null;
	}

	private Map<Long, Set<JobCategory>> authorCategories(List<Post> pool) {
		Set<Long> authorIds = new HashSet<>();
		for (Post post : pool) {
			authorIds.add(post.getAuthor().getId());
		}
		if (authorIds.isEmpty()) {
			return Map.of();
		}
		Map<Long, Set<JobCategory>> out = new HashMap<>();
		for (Object[] row : jobCategories.findCategoryRowsByUserIds(authorIds)) {
			out.computeIfAbsent(((Number) row[0]).longValue(), id -> EnumSet.noneOf(JobCategory.class))
					.add((JobCategory) row[1]);
		}
		return out;
	}

	/** "React를" / "Spring을": 을 after a final consonant (Hangul batchim, Latin l/m/n/ng, digits 0 1 3 6 7 8). */
	static String withObjectParticle(String word) {
		if (word == null || word.isEmpty()) {
			return "";
		}
		char last = word.charAt(word.length() - 1);
		boolean batchim;
		if (last >= '가' && last <= '힣') {
			batchim = (last - '가') % 28 != 0;
		} else if (Character.isDigit(last)) {
			batchim = "013678".indexOf(last) >= 0;
		} else {
			String lower = word.toLowerCase(Locale.ROOT);
			batchim = lower.endsWith("l") || lower.endsWith("m") || lower.endsWith("n") || lower.endsWith("ng");
		}
		return word + (batchim ? "을" : "를");
	}

	/** Same seed, same order: rows are sorted by id first so the input order doesn't matter. */
	private static List<ScoredPost> shuffled(List<Post> rows, long seed) {
		List<Post> sorted = new ArrayList<>(rows);
		sorted.sort(Comparator.comparingLong(Post::getId));
		Collections.shuffle(sorted, new Random(seed));
		List<ScoredPost> out = new ArrayList<>(sorted.size());
		for (Post post : sorted) {
			out.add(new ScoredPost(post, 0, null));
		}
		return out;
	}

	private Map<Long, Double> popularityScores(List<Post> candidates, Instant matureBefore, Instant now) {
		if (candidates.isEmpty()) {
			return Map.of();
		}
		List<Long> ids = candidates.stream().map(Post::getId).toList();
		Map<Long, Long> likeCounts = toCountMap(likes.countMatureLikesByPostIds(ids, matureBefore));
		Map<Long, Long> commentCounts = toCountMap(comments.countNonAuthorByPostIds(ids));
		Map<Long, Double> scores = new HashMap<>();
		for (Post post : candidates) {
			long likeCount = likeCounts.getOrDefault(post.getId(), 0L);
			long commentCount = commentCounts.getOrDefault(post.getId(), 0L);
			double raw = likeCount + commentCount * 2.0;
			double ageDays = Math.max(0, Duration.between(post.getCreatedAt(), now).toHours() / 24.0);
			double score = raw / Math.pow(ageDays + 2.0, 1.5);
			scores.put(post.getId(), score);
		}
		return scores;
	}

	private static Map<Long, Long> toCountMap(List<Object[]> rows) {
		Map<Long, Long> map = new HashMap<>();
		for (Object[] row : rows) {
			map.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
		}
		return map;
	}

	private static List<ScoredPost> limitConsecutiveAuthors(List<ScoredPost> source) {
		if (source.size() <= PlanLimits.FEED_MAX_CONSECUTIVE_SAME_AUTHOR) {
			return source;
		}
		List<ScoredPost> remaining = new ArrayList<>(source);
		List<ScoredPost> out = new ArrayList<>(source.size());
		ToLongFunction<ScoredPost> authorOf = row -> row.post().getAuthor().getId();
		while (!remaining.isEmpty()) {
			int pick = -1;
			for (int i = 0; i < remaining.size(); i++) {
				long authorId = authorOf.applyAsLong(remaining.get(i));
				if (!wouldExceedAuthorRun(out, authorId, authorOf)) {
					pick = i;
					break;
				}
			}
			if (pick < 0) {
				pick = 0;
			}
			out.add(remaining.remove(pick));
		}
		return out;
	}

	private static boolean wouldExceedAuthorRun(
			List<ScoredPost> out,
			long authorId,
			ToLongFunction<ScoredPost> authorOf
	) {
		int max = PlanLimits.FEED_MAX_CONSECUTIVE_SAME_AUTHOR;
		if (out.size() < max) {
			return false;
		}
		for (int i = 1; i <= max; i++) {
			if (authorOf.applyAsLong(out.get(out.size() - i)) != authorId) {
				return false;
			}
		}
		return true;
	}

	/** Feed cursor {@code <sessionStartMillis>.<offset>}; no cursor starts a new session now. */
	private record FeedCursor(Instant startedAt, int offset) {

		static FeedCursor parse(String cursor, Instant now) {
			if (cursor == null || cursor.isBlank()) {
				return new FeedCursor(now.truncatedTo(ChronoUnit.MILLIS), 0);
			}
			String[] parts = cursor.trim().split("\\.", -1);
			if (parts.length == 2) {
				try {
					long startedAt = Long.parseLong(parts[0]);
					int offset = Integer.parseInt(parts[1]);
					if (startedAt > 0 && offset >= 0) {
						return new FeedCursor(Instant.ofEpochMilli(startedAt), offset);
					}
				} catch (NumberFormatException ignored) {
					// falls through to the validation error
				}
			}
			throw new ApiException(400, "VALIDATION_ERROR", "커서를 확인해 주세요");
		}

		long seed() {
			return startedAt.toEpochMilli();
		}

		String at(int nextOffset) {
			return startedAt.toEpochMilli() + "." + nextOffset;
		}
	}

	private record ScoredPost(Post post, double score, String whyShown) {
	}

	private Post loadReadable(long postId, AuthenticatedUser viewer) {
		Post post = posts.findDetailedById(postId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", UNAVAILABLE));
		long authorId = post.getAuthor().getId();
		if (viewer != null && blocked(viewer.userId(), authorId)) {
			throw new ApiException(404, "NOT_FOUND", UNAVAILABLE);
		}
		boolean isAuthor = viewer != null && viewer.userId() == authorId;
		if (post.getVisibility() != PostVisibility.VISIBLE && !isAuthor) {
			throw new ApiException(404, "NOT_FOUND", UNAVAILABLE);
		}
		return post;
	}

	private void recordView(Post post, long viewerId, PostViewSource source) {
		LocalDate today = LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC);
		var existing = views.findByPostIdAndViewerIdAndViewDate(post.getId(), viewerId, today);
		if (existing.isPresent()) {
			return;
		}
		User viewer = users.findById(viewerId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));
		views.save(PostView.of(post, viewer, today, source));
		post.increaseViewCount();
	}

	private boolean blocked(long a, long b) {
		return blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(a, b)
				|| blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(b, a);
	}

	private static PostViewSource resolveSource(String from) {
		if (from == null || from.isBlank()) {
			return PostViewSource.FEED;
		}
		return switch (from.trim().toLowerCase()) {
			case "share" -> PostViewSource.EXTERNAL;
			case "feed" -> PostViewSource.FEED;
			case "profile" -> PostViewSource.PROFILE;
			case "recruit", "recruit_post" -> PostViewSource.RECRUIT_POST;
			case "chat", "chat_share" -> PostViewSource.CHAT_SHARE;
			case "external" -> PostViewSource.EXTERNAL;
			default -> PostViewSource.FEED;
		};
	}

	private static String trafficLabel(PostViewSource source, String from) {
		if ("share".equalsIgnoreCase(from == null ? "" : from.trim())) {
			return "EXTERNAL_LINK";
		}
		if (from == null || from.isBlank()) {
			return "DIRECT";
		}
		return source.name();
	}

	private static boolean isRepoAvailable(Post post) {
		return post.getRepo().getDeletedAt() == null && !post.getRepo().isPrivate();
	}

	private PostRepoCardResponse toRepoCard(Post post, boolean available) {
		var repo = post.getRepo();
		return new PostRepoCardResponse(
				repo.getId(),
				available ? repo.getFullName() : "",
				available ? repo.getDescription() : null,
				available ? repo.getPrimaryLanguage() : null,
				available ? repo.getStargazersCount() : 0,
				available ? repo.getForksCount() : 0,
				repo.isFork(),
				available ? "PUBLIC" : "PRIVATE_OR_DELETED",
				post.getMyCommitCount(),
				post.getLinkerIssueCount()
		);
	}

	private PostCardResponse toCard(Post post) {
		boolean available = isRepoAvailable(post);
		String cover = post.getImages().isEmpty()
				? null
				: (post.getImages().getFirst().getFile().getUrl());
		return new PostCardResponse(
				post.getId(),
				authors.toAuthor(post.getAuthor()),
				post.getSummary(),
				cover,
				available ? post.getRepo().getFullName() : "",
				available ? post.getRepo().getPrimaryLanguage() : null,
				post.getTags().stream().map(PostTag::getTag).map(tag -> tag.getName()).toList(),
				post.getLikeCount(),
				post.getCommentCount(),
				iso(post.getCreatedAt()),
				post.getEditedAt() == null ? null : iso(post.getEditedAt()),
				available
		);
	}

	private CommentResponse toComment(Comment comment) {
		boolean deleted = comment.isDeleted();
		return new CommentResponse(
				comment.getId(),
				comment.getPost().getId(),
				comment.getParent() == null ? null : comment.getParent().getId(),
				authors.toAuthor(comment.getAuthor()),
				deleted ? DELETED_COMMENT : comment.getBody(),
				deleted,
				iso(comment.getCreatedAt()),
				comment.getEditedAt() == null ? null : iso(comment.getEditedAt())
		);
	}

	private static PostPeriodResponse toPeriod(Post post) {
		if (post.getPeriodStart() == null) {
			return null;
		}
		return new PostPeriodResponse(
				YearMonth.from(post.getPeriodStart()).toString(),
				post.getPeriodEnd() == null ? null : YearMonth.from(post.getPeriodEnd()).toString()
		);
	}

	private static String iso(Instant instant) {
		return instant == null ? null : instant.toString();
	}
}
