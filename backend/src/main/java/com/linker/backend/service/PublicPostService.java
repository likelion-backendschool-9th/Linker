package com.linker.backend.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
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
import com.linker.backend.entity.account.JobSeekingStatus;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.entity.post.Comment;
import com.linker.backend.entity.post.Post;
import com.linker.backend.entity.post.PostDemoLink;
import com.linker.backend.entity.post.PostTag;
import com.linker.backend.entity.post.PostView;
import com.linker.backend.entity.post.PostViewSource;
import com.linker.backend.entity.post.PostVisibility;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.CurrentUser;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.moderation.UserBlockRepository;
import com.linker.backend.repository.post.CommentRepository;
import com.linker.backend.repository.post.FeedSeenPostRepository;
import com.linker.backend.repository.post.PostLikeRepository;
import com.linker.backend.repository.post.PostRepository;
import com.linker.backend.repository.post.PostViewRepository;
import com.linker.backend.service.recruit.RecruitCardMapper;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PublicPostService {

	private static final String UNAVAILABLE = "삭제되었거나 볼 수 없는 콘텐츠예요";
	private static final String DELETED_COMMENT = "삭제된 댓글입니다";
	private static final String WHY_POPULAR = "이번 주 인기";
	private static final String WHY_NEW = "새로 올라온 작업물";

	private final PostRepository posts;
	private final CommentRepository comments;
	private final PostLikeRepository likes;
	private final PostViewRepository views;
	private final FeedSeenPostRepository seenPosts;
	private final UserRepository users;
	private final UserBlockRepository blocks;
	private final RecruitCardMapper authors;
	private final Clock clock;

	public PublicPostService(
			PostRepository posts,
			CommentRepository comments,
			PostLikeRepository likes,
			PostViewRepository views,
			FeedSeenPostRepository seenPosts,
			UserRepository users,
			UserBlockRepository blocks,
			RecruitCardMapper authors,
			Clock clock
	) {
		this.posts = posts;
		this.comments = comments;
		this.likes = likes;
		this.views = views;
		this.seenPosts = seenPosts;
		this.users = users;
		this.blocks = blocks;
		this.authors = authors;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public CursorPage<FeedPostItemResponse> feed(String cursor, Boolean offersOnly) {
		AuthenticatedUser viewer = CurrentUser.optional().orElse(null);
		boolean onlyOffers = Boolean.TRUE.equals(offersOnly);
		Instant now = clock.instant();
		Instant weekAgo = now.minus(PlanLimits.FEED_RECOMMENDATION_DAYS, ChronoUnit.DAYS);
		Instant matureBefore = now.minus(PlanLimits.FEED_NEW_ACCOUNT_LIKE_EXCLUSION_DAYS, ChronoUnit.DAYS);

		List<Post> candidates = filterCandidates(posts.findVisibleForFeed(), viewer, onlyOffers);
		Map<Long, Double> scores = popularityScores(candidates, matureBefore, now);

		List<ScoredPost> ordered;
		if (viewer == null) {
			ordered = guestFeed(candidates, scores, weekAgo);
		} else {
			ordered = loggedInFeed(viewer, candidates, scores, weekAgo);
		}
		ordered = limitConsecutiveAuthors(ordered);

		int offset = parseOffset(cursor);
		int from = Math.min(offset, ordered.size());
		int to = Math.min(from + PlanLimits.FEED_PAGE_SIZE, ordered.size());
		List<FeedPostItemResponse> items = new ArrayList<>(to - from);
		for (ScoredPost row : ordered.subList(from, to)) {
			Post post = row.post();
			post.getImages().size();
			post.getTags().size();
			items.add(FeedPostItemResponse.of(toCard(post), row.whyShown()));
		}
		String next = to < ordered.size() ? Integer.toString(to) : null;
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
		List<Comment> rows = comments.findByPostIdOrderByIdAsc(postId);
		Set<Long> parentsWithReplies = new HashSet<>();
		for (Comment row : rows) {
			if (row.getParent() != null) {
				parentsWithReplies.add(row.getParent().getId());
			}
		}
		List<CommentResponse> items = new ArrayList<>();
		for (Comment row : rows) {
			if (row.isDeleted() && !parentsWithReplies.contains(row.getId())) {
				continue;
			}
			items.add(toComment(row));
		}
		return new CommentListResponse(items);
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

	private List<ScoredPost> guestFeed(List<Post> candidates, Map<Long, Double> scores, Instant weekAgo) {
		List<ScoredPost> rows = new ArrayList<>(candidates.size());
		for (Post post : candidates) {
			double score = scores.getOrDefault(post.getId(), 0.0);
			boolean popularWeek = !post.getCreatedAt().isBefore(weekAgo) && score > 0;
			rows.add(new ScoredPost(post, score, popularWeek ? WHY_POPULAR : WHY_NEW));
		}
		rows.sort(Comparator
				.comparingDouble(ScoredPost::score).reversed()
				.thenComparing(row -> row.post().getCreatedAt(), Comparator.reverseOrder())
				.thenComparing(row -> row.post().getId(), Comparator.reverseOrder()));
		return rows;
	}

	/**
	 * follows / user_tech_tags are owned by A/04 and not present yet → following stream empty,
	 * so the feed is recommendation-only; whyShown skips follow-like / 2nd-degree / stack reasons.
	 */
	private List<ScoredPost> loggedInFeed(
			AuthenticatedUser viewer,
			List<Post> candidates,
			Map<Long, Double> scores,
			Instant weekAgo
	) {
		Set<Long> seen = new HashSet<>(seenPosts.findPostIdsByUserId(viewer.userId()));
		List<Post> following = List.of(); // no follows table yet
		List<ScoredPost> recommended = new ArrayList<>();
		for (Post post : candidates) {
			long authorId = post.getAuthor().getId();
			if (authorId == viewer.userId()) {
				continue;
			}
			if (seen.contains(post.getId())) {
				continue;
			}
			if (post.getCreatedAt().isBefore(weekAgo)) {
				continue;
			}
			double score = scores.getOrDefault(post.getId(), 0.0);
			recommended.add(new ScoredPost(post, score, whyShownForRecommendation(post, score, weekAgo)));
		}
		recommended.sort(Comparator
				.comparingDouble(ScoredPost::score).reversed()
				.thenComparing(row -> row.post().getCreatedAt(), Comparator.reverseOrder())
				.thenComparing(row -> row.post().getId(), Comparator.reverseOrder()));

		if (following.isEmpty()) {
			return recommended;
		}

		List<ScoredPost> followingRows = following.stream()
				.map(post -> new ScoredPost(post, scores.getOrDefault(post.getId(), 0.0), WHY_NEW))
				.toList();
		return interleaveFollowingAndRecommended(followingRows, recommended);
	}

	private static List<ScoredPost> interleaveFollowingAndRecommended(
			List<ScoredPost> following,
			List<ScoredPost> recommended
	) {
		List<ScoredPost> mixed = new ArrayList<>(following.size() + recommended.size());
		int fi = 0;
		int ri = 0;
		while (fi < following.size() || ri < recommended.size()) {
			for (int i = 0; i < PlanLimits.FEED_FOLLOWING_PER_RECOMMENDATION && fi < following.size(); i++) {
				mixed.add(following.get(fi++));
			}
			if (ri < recommended.size()) {
				mixed.add(recommended.get(ri++));
			}
		}
		return mixed;
	}

	private static String whyShownForRecommendation(Post post, double score, Instant weekAgo) {
		// Priority 1–3 need follows / 2nd-degree / user_tech_tags — deferred.
		if (!post.getCreatedAt().isBefore(weekAgo) && score > 0) {
			return WHY_POPULAR;
		}
		return WHY_NEW;
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

	private static int parseOffset(String cursor) {
		if (cursor == null || cursor.isBlank()) {
			return 0;
		}
		try {
			int offset = Integer.parseInt(cursor.trim());
			return Math.max(0, offset);
		} catch (NumberFormatException ex) {
			throw new ApiException(400, "VALIDATION_ERROR", "커서를 확인해 주세요");
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
