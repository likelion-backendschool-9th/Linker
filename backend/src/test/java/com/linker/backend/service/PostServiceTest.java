package com.linker.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.linker.backend.dto.recruit.response.AuthorBriefResponse;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.github.GithubRepo;
import com.linker.backend.entity.post.Comment;
import com.linker.backend.entity.post.Post;
import com.linker.backend.entity.post.PostTag;
import com.linker.backend.entity.post.PostView;
import com.linker.backend.entity.post.type.PostViewSource;
import com.linker.backend.entity.post.type.PostVisibility;
import com.linker.backend.entity.profile.TechTag;
import com.linker.backend.entity.profile.UserJobCategory;
import com.linker.backend.entity.profile.UserTechTag;
import com.linker.backend.entity.profile.type.JobCategory;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
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

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class PostServiceTest {

	private static final Instant NOW = Instant.parse("2026-11-05T01:00:00Z");
	private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

	@Mock
	PostRepository posts;
	@Mock
	CommentRepository comments;
	@Mock
	PostLikeRepository likes;
	@Mock
	PostViewRepository views;
	@Mock
	FeedSeenPostRepository seenPosts;
	@Mock
	PinnedPostRepository pins;
	@Mock
	UserRepository users;
	@Mock
	UserBlockRepository blocks;
	@Mock
	RecruitCardMapper authors;
	@Mock
	FollowRepository follows;
	@Mock
	UserTechTagRepository techTags;
	@Mock
	UserJobCategoryRepository jobCategories;
	@Mock
	com.linker.backend.repository.moderation.ReportRepository reports;

	PostService service;

	@BeforeEach
	void setUp() {
		service = new PostService(
				posts, comments, likes, views, seenPosts, pins, users, blocks, authors,
				follows, techTags, jobCategories, reports, CLOCK);
		SecurityContextHolder.clearContext();
	}

	@AfterEach
	void tearDown() {
		SecurityContextHolder.clearContext();
	}

	@Test
	void detailHidesNonVisibleFromNonAuthor() {
		Post post = post(10L, PostVisibility.UNDER_REVIEW);
		when(posts.findDetailedById(42L)).thenReturn(Optional.of(post));
		setViewer(99L, "viewer");

		assertThatThrownBy(() -> service.detail(42L, null))
				.isInstanceOf(ApiException.class)
				.satisfies(error -> assertThat(((ApiException) error).getCode()).isEqualTo("NOT_FOUND"));
	}

	@Test
	void detailRecordsExternalViewForShare() {
		Post post = post(10L, PostVisibility.VISIBLE);
		User viewer = User.create("viewer", UserType.DEVELOPER);
		ReflectionTestUtils.setField(viewer, "id", 99L);
		when(posts.findDetailedById(42L)).thenReturn(Optional.of(post));
		when(blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(anyLong(), anyLong())).thenReturn(false);
		when(likes.existsByPostIdAndUserId(42L, 99L)).thenReturn(false);
		when(views.findByPostIdAndViewerIdAndViewDate(eq(42L), eq(99L), any(LocalDate.class)))
				.thenReturn(Optional.empty());
		when(users.findById(99L)).thenReturn(Optional.of(viewer));
		when(authors.toAuthor(any(), anyBoolean())).thenReturn(new AuthorBriefResponse(10L, "author", "Author", "", "DEVELOPER", "OFF", false));
		setViewer(99L, "viewer");

		var response = service.detail(42L, "share");

		assertThat(response.trafficSource()).isEqualTo("EXTERNAL_LINK");
		assertThat(response.viewCount()).isEqualTo(1);
		ArgumentCaptor<PostView> captor = ArgumentCaptor.forClass(PostView.class);
		verify(views).save(captor.capture());
		assertThat(captor.getValue().getSource()).isEqualTo(PostViewSource.EXTERNAL);
	}

	@Test
	void detailSkipsViewForAuthor() {
		Post post = post(10L, PostVisibility.VISIBLE);
		when(posts.findDetailedById(42L)).thenReturn(Optional.of(post));
		when(blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(anyLong(), anyLong())).thenReturn(false);
		when(likes.existsByPostIdAndUserId(42L, 10L)).thenReturn(false);
		when(authors.toAuthor(any(), anyBoolean())).thenReturn(new AuthorBriefResponse(10L, "author", "Author", "", "DEVELOPER", "OFF", false));
		setViewer(10L, "author");

		service.detail(42L, "feed");

		verify(views, never()).save(any());
	}

	@Test
	void detailTellsAViewerWhetherTheyFollowTheAuthor() {
		Post post = post(10L, PostVisibility.VISIBLE);
		User viewer = User.create("viewer", UserType.DEVELOPER);
		ReflectionTestUtils.setField(viewer, "id", 99L);
		when(posts.findDetailedById(42L)).thenReturn(Optional.of(post));
		when(views.findByPostIdAndViewerIdAndViewDate(eq(42L), eq(99L), any(LocalDate.class)))
				.thenReturn(Optional.empty());
		when(users.findById(99L)).thenReturn(Optional.of(viewer));
		when(follows.existsByFollower_IdAndFollowing_Id(99L, 10L)).thenReturn(true);
		when(authors.toAuthor(any(), eq(true))).thenReturn(new AuthorBriefResponse(10L, "author", "Author", "", "DEVELOPER", "OFF", true));
		setViewer(99L, "viewer");

		assertThat(service.detail(42L, null).author().isFollowing()).isTrue();
	}

	@Test
	void aPostIReportedIsGoneForMeButNotForItsAuthor() {
		Post post = post(10L, PostVisibility.VISIBLE);
		when(posts.findDetailedById(42L)).thenReturn(Optional.of(post));
		when(reports.findTargetIdsReportedBy(99L, com.linker.backend.entity.moderation.type.ReportTargetType.POST))
				.thenReturn(List.of(42L));
		setViewer(99L, "viewer");

		assertThatThrownBy(() -> service.detail(42L, null))
				.isInstanceOf(ApiException.class)
				.satisfies(error -> assertThat(((ApiException) error).getStatus()).isEqualTo(404));
	}

	@Test
	void commentsUnderReviewOrReportedByMeLeaveMyListButTheirAuthorKeepsThem() {
		Post post = post(10L, PostVisibility.VISIBLE);
		User me = User.create("viewer", UserType.DEVELOPER);
		ReflectionTestUtils.setField(me, "id", 99L);
		User other = User.create("other", UserType.DEVELOPER);
		ReflectionTestUtils.setField(other, "id", 50L);
		Comment mineUnderReview = comment(1L, post, me, PostVisibility.UNDER_REVIEW);
		Comment othersUnderReview = comment(2L, post, other, PostVisibility.UNDER_REVIEW);
		Comment reportedByMe = comment(3L, post, other, PostVisibility.VISIBLE);
		Comment plain = comment(4L, post, other, PostVisibility.VISIBLE);
		when(posts.findDetailedById(42L)).thenReturn(Optional.of(post));
		when(comments.findByPostIdOrderByIdAsc(42L))
				.thenReturn(List.of(mineUnderReview, othersUnderReview, reportedByMe, plain));
		when(reports.findTargetIdsReportedBy(99L, com.linker.backend.entity.moderation.type.ReportTargetType.POST))
				.thenReturn(List.of());
		when(reports.findTargetIdsReportedBy(99L, com.linker.backend.entity.moderation.type.ReportTargetType.COMMENT))
				.thenReturn(List.of(3L));
		setViewer(99L, "viewer");

		assertThat(service.comments(42L).items()).extracting(item -> item.id()).containsExactly(1L, 4L);
	}

	private static Comment comment(long id, Post post, User author, PostVisibility visibility) {
		Comment comment = Comment.write(post, author, null, "댓글 " + id);
		ReflectionTestUtils.setField(comment, "id", id);
		ReflectionTestUtils.setField(comment, "visibility", visibility);
		ReflectionTestUtils.setField(comment, "createdAt", NOW);
		return comment;
	}

	@Test
	void readmeIsIncludedStub() {
		Post post = post(10L, PostVisibility.VISIBLE);
		when(posts.findDetailedById(42L)).thenReturn(Optional.of(post));

		assertThatThrownBy(() -> service.readme(42L))
				.isInstanceOf(ApiException.class)
				.satisfies(error -> assertThat(((ApiException) error).getCode()).isEqualTo("NOT_IMPLEMENTED"));
	}

	@Test
	void guestRecommendedFeedIsShuffledOncePerSessionWithoutWhyShown() {
		List<Post> rows = new ArrayList<>();
		for (long id = 1; id <= 12; id++) {
			rows.add(postWithId(id, 100L + id, PostVisibility.VISIBLE, NOW.minusSeconds(id * 60)));
		}
		when(posts.findVisibleForFeed()).thenReturn(rows);
		stubAuthors();

		var first = service.feed(null, null, false);
		var again = service.feed(null, null, false);
		var second = service.feed(null, first.nextCursor(), false);

		assertThat(first.items()).hasSize(10);
		assertThat(first.nextCursor()).isEqualTo(NOW.toEpochMilli() + ".10");
		assertThat(first.items()).extracting(item -> item.whyShown()).containsOnlyNulls();
		assertThat(again.items()).extracting(item -> item.post().id())
				.containsExactlyElementsOf(first.items().stream().map(item -> item.post().id()).toList());
		assertThat(second.nextCursor()).isNull();
		List<Long> seen = new ArrayList<>();
		first.items().forEach(item -> seen.add(item.post().id()));
		second.items().forEach(item -> seen.add(item.post().id()));
		assertThat(seen).containsExactlyInAnyOrder(1L, 2L, 3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L, 11L, 12L);
		assertThat(seen).isNotEqualTo(List.of(1L, 2L, 3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L, 11L, 12L));
	}

	@Test
	void recommendedFeedLeavesOutPostsWrittenAfterTheSessionStarted() {
		Post before = postWithId(1L, 10L, PostVisibility.VISIBLE, NOW.minusSeconds(7200));
		Post after = postWithId(2L, 11L, PostVisibility.VISIBLE, NOW.minusSeconds(60));
		when(posts.findVisibleForFeed()).thenReturn(List.of(after, before));
		stubAuthors();

		String cursor = NOW.minusSeconds(3600).toEpochMilli() + ".0";
		var page = service.feed("recommended", cursor, null);

		assertThat(page.items()).extracting(item -> item.post().id()).containsExactly(1L);
	}

	@Test
	void recruiterRecommendedFeedIsShuffledWithoutMatching() {
		Post a = postWithId(1L, 10L, PostVisibility.VISIBLE, NOW.minusSeconds(100));
		Post b = postWithId(2L, 11L, PostVisibility.VISIBLE, NOW.minusSeconds(90));
		when(posts.findVisibleForFeed()).thenReturn(List.of(a, b));
		when(blocks.findActiveBlockedIds(77L)).thenReturn(List.of());
		when(blocks.findActiveBlockerIds(77L)).thenReturn(List.of());
		stubAuthors();
		setViewer(77L, "recruiter", UserType.RECRUITER);

		var page = service.feed(null, null, null);

		assertThat(page.items()).extracting(item -> item.post().id()).containsExactlyInAnyOrder(1L, 2L);
		assertThat(page.items()).extracting(item -> item.whyShown()).containsOnlyNulls();
		verify(techTags, never()).findSelected(anyLong());
		verify(seenPosts, never()).findPostIdsSeenBefore(anyLong(), any());
	}

	@Test
	void developerRecommendedFeedPutsStackAndJobCategoryMatchesFirstAndKeepsMyOwnPosts() {
		TechTag react = techTag(1L, "React");
		TechTag spring = techTag(2L, "Spring");
		Post own = postWithId(1L, 99L, PostVisibility.VISIBLE, NOW.minusSeconds(100), react);
		Post blocked = postWithId(2L, 50L, PostVisibility.VISIBLE, NOW.minusSeconds(90), react);
		Post seenMatch = postWithId(3L, 40L, PostVisibility.VISIBLE, NOW.minusSeconds(85), react);
		Post stackPopular = postWithId(4L, 10L, PostVisibility.VISIBLE, NOW.minusSeconds(80), react);
		Post stackQuiet = postWithId(5L, 20L, PostVisibility.VISIBLE, NOW.minusSeconds(70), spring, react);
		Post categoryOnly = postWithId(6L, 30L, PostVisibility.VISIBLE, NOW.minusSeconds(60), spring);
		Post other1 = postWithId(7L, 60L, PostVisibility.VISIBLE, NOW.minusSeconds(50), spring);
		Post other2 = postWithId(8L, 70L, PostVisibility.VISIBLE, NOW.minusSeconds(40));
		when(posts.findVisibleForFeed()).thenReturn(
				List.of(own, blocked, seenMatch, stackPopular, stackQuiet, categoryOnly, other1, other2));
		when(blocks.findActiveBlockedIds(99L)).thenReturn(List.of(50L));
		when(blocks.findActiveBlockerIds(99L)).thenReturn(List.of());
		when(seenPosts.findPostIdsSeenBefore(99L, NOW)).thenReturn(List.of(3L));
		User viewer = User.create("viewer", UserType.DEVELOPER);
		when(techTags.findSelected(99L)).thenReturn(List.of(UserTechTag.link(viewer, react)));
		when(jobCategories.findByUser_IdOrderByIdAsc(99L))
				.thenReturn(List.of(UserJobCategory.pick(viewer, JobCategory.FRONTEND)));
		when(jobCategories.findCategoryRowsByUserIds(any())).thenReturn(List.<Object[]>of(
				new Object[]{30L, JobCategory.FRONTEND}, new Object[]{60L, JobCategory.BACKEND}));
		when(likes.countMatureLikesByPostIds(any(), any())).thenReturn(List.<Object[]>of(
				new Object[]{4L, 5L}, new Object[]{5L, 1L}, new Object[]{6L, 3L}));
		when(comments.countNonAuthorByPostIds(any())).thenReturn(List.of());
		stubAuthors();
		setViewer(99L, "viewer", UserType.DEVELOPER);

		var page = service.feed(null, null, null);

		// My own React post (1) stays, ranked with the matches (no likes → after them) but with no
		// "why shown"; only the blocked author's post (2) is left out
		assertThat(page.items()).extracting(item -> item.post().id())
				.doesNotContain(2L)
				.startsWith(4L, 6L, 5L, 1L)
				.endsWith(3L)
				.containsExactlyInAnyOrder(1L, 3L, 4L, 5L, 6L, 7L, 8L);
		assertThat(page.items().get(0).whyShown()).isEqualTo("React를 쓰는 사람들의 인기 글");
		assertThat(page.items().get(1).whyShown()).isEqualTo("프론트엔드 직군의 인기 글");
		assertThat(page.items().get(2).whyShown()).isEqualTo("React를 쓰는 사람들의 인기 글");
		assertThat(page.items().subList(3, 7)).extracting(item -> item.whyShown()).containsOnlyNulls();
	}

	@Test
	void followingFeedListsFollowedAuthorsNewestFirst() {
		Post followedOld = postWithId(1L, 10L, PostVisibility.VISIBLE, NOW.minusSeconds(300));
		Post stranger = postWithId(2L, 11L, PostVisibility.VISIBLE, NOW.minusSeconds(200));
		Post followedNew = postWithId(3L, 12L, PostVisibility.VISIBLE, NOW.minusSeconds(100));
		when(posts.findVisibleForFeed()).thenReturn(List.of(followedNew, stranger, followedOld));
		when(blocks.findActiveBlockedIds(99L)).thenReturn(List.of());
		when(blocks.findActiveBlockerIds(99L)).thenReturn(List.of());
		when(follows.findAllFollowedIds(99L)).thenReturn(List.of(10L, 12L));
		stubAuthors();
		setViewer(99L, "viewer", UserType.DEVELOPER);

		var page = service.feed("following", null, true);

		assertThat(page.items()).extracting(item -> item.post().id()).containsExactly(3L, 1L);
		assertThat(page.items()).extracting(item -> item.whyShown()).containsOnlyNulls();
	}

	@Test
	void followingFeedIsEmptyForGuests() {
		when(posts.findVisibleForFeed()).thenReturn(List.of(postWithId(1L, 10L, PostVisibility.VISIBLE, NOW)));

		var page = service.feed("following", null, null);

		assertThat(page.items()).isEmpty();
		assertThat(page.nextCursor()).isNull();
		verify(follows, never()).findAllFollowedIds(anyLong());
	}

	@Test
	void feedRejectsUnknownTabAndBrokenCursor() {
		assertThatThrownBy(() -> service.feed("popular", null, null))
				.isInstanceOf(ApiException.class)
				.hasMessage("탭을 확인해 주세요");
		assertThatThrownBy(() -> service.feed(null, "10", null))
				.isInstanceOf(ApiException.class)
				.hasMessage("커서를 확인해 주세요");
	}

	@Test
	void objectParticleFollowsTheLastSound() {
		assertThat(PostService.withObjectParticle("React")).isEqualTo("React를");
		assertThat(PostService.withObjectParticle("Spring")).isEqualTo("Spring을");
		assertThat(PostService.withObjectParticle("Kotlin")).isEqualTo("Kotlin을");
		assertThat(PostService.withObjectParticle("Vue")).isEqualTo("Vue를");
		assertThat(PostService.withObjectParticle("파이썬")).isEqualTo("파이썬을");
		assertThat(PostService.withObjectParticle("자바")).isEqualTo("자바를");
	}

	@Test
	void profilePostsListsVisibleCardsAndHidesABlockedAuthor() {
		User author = User.create("octocat", UserType.DEVELOPER);
		ReflectionTestUtils.setField(author, "id", 7L);
		when(users.findByUsername("octocat")).thenReturn(Optional.of(author));
		when(posts.findVisibleByAuthorId(7L)).thenReturn(List.of(postWithId(5L, 7L, PostVisibility.VISIBLE, NOW)));
		when(authors.toAuthor(any(), anyBoolean())).thenReturn(
				new AuthorBriefResponse(7L, "octocat", "octocat", "", "DEVELOPER", "OFF", false));

		assertThat(service.profilePosts("octocat").items()).extracting(item -> item.id()).containsExactly(5L);

		setViewer(3L, "other");
		when(blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(3L, 7L)).thenReturn(true);
		assertThatThrownBy(() -> service.profilePosts("octocat"))
				.isInstanceOf(ApiException.class)
				.hasMessage("볼 수 없는 프로필");
	}

	@Test
	void profilePostsReturnsNothingForARecruiter() {
		User recruiter = User.create("r-1", UserType.RECRUITER);
		ReflectionTestUtils.setField(recruiter, "id", 8L);
		when(users.findByUsername("r-1")).thenReturn(Optional.of(recruiter));

		assertThat(service.profilePosts("r-1").items()).isEmpty();
		verify(posts, never()).findVisibleByAuthorId(anyLong());
	}

	@Test
	void feedOffersOnlyExcludesOffSeekingAuthors() {
		Post open = postWithId(1L, 10L, PostVisibility.VISIBLE, NOW);
		ReflectionTestUtils.setField(open.getAuthor(), "jobSeekingStatus",
				com.linker.backend.entity.account.type.JobSeekingStatus.OPEN);
		Post off = postWithId(2L, 11L, PostVisibility.VISIBLE, NOW);
		when(posts.findVisibleForFeed()).thenReturn(List.of(open, off));
		when(authors.toAuthor(any(), anyBoolean()))
				.thenReturn(new AuthorBriefResponse(10L, "a", "a", "", "DEVELOPER", "OPEN", false));

		var page = service.feed(null, null, true);

		assertThat(page.items()).hasSize(1);
		assertThat(page.items().getFirst().post().id()).isEqualTo(1L);
	}

	/** Feed cards call the two-arg mapper; detail/comments keep the one-arg form. */
	private void stubAuthors() {
		when(authors.toAuthor(any(), anyBoolean())).thenAnswer(invocation -> {
			User author = invocation.getArgument(0);
			boolean following = invocation.getArgument(1);
			return new AuthorBriefResponse(
					author.getId(), author.getUsername(), author.getUsername(), "", "DEVELOPER", "OFF", following);
		});
	}

	private TechTag techTag(long id, String name) {
		TechTag tag = new TechTag() {
		};
		ReflectionTestUtils.setField(tag, "id", id);
		ReflectionTestUtils.setField(tag, "name", name);
		return tag;
	}

	private void setViewer(long userId, String login) {
		setViewer(userId, login, UserType.DEVELOPER);
	}

	private void setViewer(long userId, String login, UserType type) {
		AuthenticatedUser user = new AuthenticatedUser(
				userId, login, type, UserStatus.ACTIVE,
				null, false, false, true, 1L);
		SecurityContextHolder.getContext().setAuthentication(
				new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
	}

	private Post post(long authorId, PostVisibility visibility) {
		return postWithId(42L, authorId, visibility, NOW);
	}

	private Post postWithId(long postId, long authorId, PostVisibility visibility, Instant createdAt, TechTag... tags) {
		User author = User.create("author" + authorId, UserType.DEVELOPER);
		ReflectionTestUtils.setField(author, "id", authorId);
		GithubRepo repo = new GithubRepo() {
		};
		ReflectionTestUtils.setField(repo, "id", 1000L + postId);
		ReflectionTestUtils.setField(repo, "fullName", "author" + authorId + "/demo" + postId);
		ReflectionTestUtils.setField(repo, "ownerLogin", "author" + authorId);
		ReflectionTestUtils.setField(repo, "name", "demo" + postId);
		ReflectionTestUtils.setField(repo, "isPrivate", false);
		ReflectionTestUtils.setField(repo, "isFork", false);
		ReflectionTestUtils.setField(repo, "stargazersCount", 1);
		ReflectionTestUtils.setField(repo, "forksCount", 0);
		Post post = Post.publish(author, repo, null, "intro", "body", null, null, null, null, 0, 0);
		ReflectionTestUtils.setField(post, "id", postId);
		ReflectionTestUtils.setField(post, "visibility", visibility);
		ReflectionTestUtils.setField(post, "createdAt", createdAt);
		List<PostTag> postTags = new ArrayList<>();
		for (TechTag tag : tags) {
			postTags.add(PostTag.of(tag.getName()));
		}
		ReflectionTestUtils.setField(post, "tags", postTags);
		return post;
	}
}
