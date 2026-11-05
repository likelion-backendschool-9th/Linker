package com.linker.backend.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import com.linker.backend.dto.post.response.CommentListResponse;
import com.linker.backend.dto.post.response.CommentResponse;
import com.linker.backend.dto.post.response.PostCardListResponse;
import com.linker.backend.dto.post.response.PostCardResponse;
import com.linker.backend.dto.post.response.PostDetailResponse;
import com.linker.backend.dto.post.response.PostPeriodResponse;
import com.linker.backend.dto.post.response.PostReadmeResponse;
import com.linker.backend.dto.post.response.PostRepoCardResponse;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.entity.post.Comment;
import com.linker.backend.entity.post.Post;
import com.linker.backend.entity.post.PostDemoLink;
import com.linker.backend.entity.post.PostImage;
import com.linker.backend.entity.post.PostTag;
import com.linker.backend.entity.post.PostView;
import com.linker.backend.entity.post.PostViewSource;
import com.linker.backend.entity.post.PostVisibility;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.CurrentUser;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.moderation.UserBlockRepository;
import com.linker.backend.repository.post.CommentRepository;
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

	private final PostRepository posts;
	private final CommentRepository comments;
	private final PostLikeRepository likes;
	private final PostViewRepository views;
	private final UserRepository users;
	private final UserBlockRepository blocks;
	private final RecruitCardMapper authors;
	private final Clock clock;

	public PublicPostService(
			PostRepository posts,
			CommentRepository comments,
			PostLikeRepository likes,
			PostViewRepository views,
			UserRepository users,
			UserBlockRepository blocks,
			RecruitCardMapper authors,
			Clock clock
	) {
		this.posts = posts;
		this.comments = comments;
		this.likes = likes;
		this.views = views;
		this.users = users;
		this.blocks = blocks;
		this.authors = authors;
		this.clock = clock;
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
