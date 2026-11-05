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
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.entity.github.GithubRepo;
import com.linker.backend.entity.post.Post;
import com.linker.backend.entity.post.PostView;
import com.linker.backend.entity.post.PostViewSource;
import com.linker.backend.entity.post.PostVisibility;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.moderation.UserBlockRepository;
import com.linker.backend.repository.post.CommentRepository;
import com.linker.backend.repository.post.PostLikeRepository;
import com.linker.backend.repository.post.PostRepository;
import com.linker.backend.repository.post.PostViewRepository;
import com.linker.backend.service.recruit.RecruitCardMapper;

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
class PublicPostServiceTest {

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
	UserRepository users;
	@Mock
	UserBlockRepository blocks;
	@Mock
	RecruitCardMapper authors;

	PublicPostService service;

	@BeforeEach
	void setUp() {
		service = new PublicPostService(posts, comments, likes, views, users, blocks, authors, CLOCK);
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

	private void setViewer(long userId, String login) {
		AuthenticatedUser user = new AuthenticatedUser(
				userId, login, UserType.DEVELOPER, UserStatus.ACTIVE,
				null, false, false, true, 1L);
		SecurityContextHolder.getContext().setAuthentication(
				new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
	}

	private Post post(long authorId, PostVisibility visibility) {
		User author = User.create("author", UserType.DEVELOPER);
		ReflectionTestUtils.setField(author, "id", authorId);
		GithubRepo repo = new GithubRepo() {
		};
		ReflectionTestUtils.setField(repo, "id", 11L);
		ReflectionTestUtils.setField(repo, "fullName", "author/demo");
		ReflectionTestUtils.setField(repo, "ownerLogin", "author");
		ReflectionTestUtils.setField(repo, "name", "demo");
		ReflectionTestUtils.setField(repo, "isPrivate", false);
		ReflectionTestUtils.setField(repo, "isFork", false);
		ReflectionTestUtils.setField(repo, "stargazersCount", 1);
		ReflectionTestUtils.setField(repo, "forksCount", 0);
		Post post = Post.publish(author, repo, null, "intro", "body", null, null, null, null, 0, 0);
		ReflectionTestUtils.setField(post, "id", 42L);
		ReflectionTestUtils.setField(post, "visibility", visibility);
		ReflectionTestUtils.setField(post, "createdAt", NOW);
		return post;
	}
}
