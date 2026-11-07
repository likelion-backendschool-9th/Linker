package com.linker.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import com.linker.backend.dto.recruit.response.AuthorBriefResponse;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.github.GithubRepo;
import com.linker.backend.entity.post.Post;
import com.linker.backend.entity.post.PostView;
import com.linker.backend.entity.post.type.PostViewSource;
import com.linker.backend.entity.post.type.PostVisibility;
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

	PostService service;

	@BeforeEach
	void setUp() {
		service = new PostService(posts, comments, likes, views, seenPosts, pins, users, blocks, authors, CLOCK);
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
		when(authors.toAuthor(any())).thenReturn(new AuthorBriefResponse(10L, "author", "Author", "", "DEVELOPER", "OFF"));
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
		when(authors.toAuthor(any())).thenReturn(new AuthorBriefResponse(10L, "author", "Author", "", "DEVELOPER", "OFF"));
		setViewer(10L, "author");

		service.detail(42L, "feed");

		verify(views, never()).save(any());
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
	void guestFeedUsesPopularOrNewWhyShown() {
		Post popular = postWithId(1L, 10L, PostVisibility.VISIBLE, NOW.minusSeconds(3600));
		Post newest = postWithId(2L, 11L, PostVisibility.VISIBLE, NOW.minusSeconds(60));
		when(posts.findVisibleForFeed()).thenReturn(List.of(newest, popular));
		when(likes.countMatureLikesByPostIds(any(), any())).thenReturn(List.<Object[]>of(new Object[]{1L, 5L}));
		when(comments.countNonAuthorByPostIds(any())).thenReturn(List.of());
		when(authors.toAuthor(any())).thenAnswer(invocation -> {
			User author = invocation.getArgument(0);
			return new AuthorBriefResponse(author.getId(), author.getUsername(), author.getUsername(), "", "DEVELOPER", "OFF");
		});

		var page = service.feed(null, false);

		assertThat(page.items()).hasSize(2);
		assertThat(page.items().getFirst().type()).isEqualTo("POST");
		assertThat(page.items().getFirst().whyShown()).isEqualTo("이번 주 인기");
		assertThat(page.items().get(1).whyShown()).isEqualTo("새로 올라온 작업물");
		assertThat(page.nextCursor()).isNull();
	}

	@Test
	void loggedInFeedExcludesSeenOwnAndBlockedAndLimitsSameAuthor() {
		Post own = postWithId(1L, 99L, PostVisibility.VISIBLE, NOW.minusSeconds(100));
		Post blocked = postWithId(2L, 50L, PostVisibility.VISIBLE, NOW.minusSeconds(90));
		Post seen = postWithId(8L, 40L, PostVisibility.VISIBLE, NOW.minusSeconds(85));
		Post a1 = postWithId(3L, 10L, PostVisibility.VISIBLE, NOW.minusSeconds(80));
		Post a2 = postWithId(4L, 10L, PostVisibility.VISIBLE, NOW.minusSeconds(70));
		Post a3 = postWithId(5L, 10L, PostVisibility.VISIBLE, NOW.minusSeconds(60));
		Post b1 = postWithId(6L, 20L, PostVisibility.VISIBLE, NOW.minusSeconds(50));
		Post c1 = postWithId(7L, 30L, PostVisibility.VISIBLE, NOW.minusSeconds(40));
		when(posts.findVisibleForFeed()).thenReturn(List.of(own, blocked, seen, a1, a2, a3, b1, c1));
		when(blocks.findActiveBlockedIds(99L)).thenReturn(List.of(50L));
		when(blocks.findActiveBlockerIds(99L)).thenReturn(List.of());
		when(seenPosts.findPostIdsByUserId(99L)).thenReturn(List.of(8L));
		when(likes.countMatureLikesByPostIds(any(), any())).thenReturn(List.<Object[]>of(
				new Object[]{3L, 3L}, new Object[]{4L, 2L}, new Object[]{5L, 1L},
				new Object[]{6L, 4L}, new Object[]{7L, 1L}
		));
		when(comments.countNonAuthorByPostIds(any())).thenReturn(List.of());
		when(authors.toAuthor(any())).thenAnswer(invocation -> {
			User author = invocation.getArgument(0);
			return new AuthorBriefResponse(author.getId(), author.getUsername(), author.getUsername(), "", "DEVELOPER", "OFF");
		});
		setViewer(99L, "viewer");

		var page = service.feed(null, null);

		assertThat(page.items()).extracting(item -> item.post().id())
				.doesNotContain(1L, 2L, 8L)
				.containsExactly(6L, 3L, 4L, 7L, 5L);
		List<Long> authorsInOrder = page.items().stream().map(item -> item.post().author().id()).toList();
		int run = 1;
		for (int i = 1; i < authorsInOrder.size(); i++) {
			if (authorsInOrder.get(i).equals(authorsInOrder.get(i - 1))) {
				run++;
				assertThat(run).isLessThanOrEqualTo(2);
			} else {
				run = 1;
			}
		}
	}

	@Test
	void profilePostsListsVisibleCardsAndHidesABlockedAuthor() {
		User author = User.create("octocat", UserType.DEVELOPER);
		ReflectionTestUtils.setField(author, "id", 7L);
		when(users.findByUsername("octocat")).thenReturn(Optional.of(author));
		when(posts.findVisibleByAuthorId(7L)).thenReturn(List.of(postWithId(5L, 7L, PostVisibility.VISIBLE, NOW)));
		when(authors.toAuthor(any())).thenReturn(
				new AuthorBriefResponse(7L, "octocat", "octocat", "", "DEVELOPER", "OFF"));

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
		when(likes.countMatureLikesByPostIds(any(), any())).thenReturn(List.of());
		when(comments.countNonAuthorByPostIds(any())).thenReturn(List.of());
		when(authors.toAuthor(any())).thenReturn(new AuthorBriefResponse(10L, "a", "a", "", "DEVELOPER", "OPEN"));

		var page = service.feed(null, true);

		assertThat(page.items()).hasSize(1);
		assertThat(page.items().getFirst().post().id()).isEqualTo(1L);
	}

	private void setViewer(long userId, String login) {
		AuthenticatedUser user = new AuthenticatedUser(
				userId, login, UserType.DEVELOPER, UserStatus.ACTIVE,
				null, false, false, true, 1L);
		SecurityContextHolder.getContext().setAuthentication(
				new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
	}

	private Post post(long authorId, PostVisibility visibility) {
		return postWithId(42L, authorId, visibility, NOW);
	}

	private Post postWithId(long postId, long authorId, PostVisibility visibility, Instant createdAt) {
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
		return post;
	}
}
