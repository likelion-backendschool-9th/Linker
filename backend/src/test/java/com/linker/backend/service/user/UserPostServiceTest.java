package com.linker.backend.service.user;

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
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import com.linker.backend.dto.post.request.CommentWriteRequest;
import com.linker.backend.dto.post.request.FeedSeenRequest;
import com.linker.backend.dto.post.request.PostPhotoRequest;
import com.linker.backend.dto.post.request.PostWriteRequest;
import com.linker.backend.entity.post.Comment;
import com.linker.backend.entity.post.FeedSeenPost;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.entity.file.UploadedFile;
import com.linker.backend.entity.file.UploadPurpose;
import com.linker.backend.entity.github.GithubRepo;
import com.linker.backend.entity.post.Post;
import com.linker.backend.entity.post.PostLike;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.RedisRateLimiter;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.github.GithubRepoRepository;
import com.linker.backend.repository.moderation.UserBlockRepository;
import com.linker.backend.repository.post.CommentRepository;
import com.linker.backend.repository.post.FeedSeenPostRepository;
import com.linker.backend.repository.post.PostLikeRepository;
import com.linker.backend.repository.post.PostRepository;
import com.linker.backend.repository.profile.TechTagRepository;
import com.linker.backend.service.recruit.RecruitCardMapper;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class UserPostServiceTest {

	private static final Instant NOW = Instant.parse("2026-11-05T01:00:00Z");
	private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

	@Mock
	GithubRepoRepository repos;
	@Mock
	PostRepository posts;
	@Mock
	UserRepository users;
	@Mock
	TechTagRepository techTags;
	@Mock
	UserUploadService uploads;
	@Mock
	PostLikeRepository likes;
	@Mock
	CommentRepository comments;
	@Mock
	FeedSeenPostRepository seenPosts;
	@Mock
	UserBlockRepository blocks;
	@Mock
	UserNotificationService notifications;
	@Mock
	RecruitCardMapper authors;
	@Mock
	RedisRateLimiter rateLimiter;

	UserPostService service;
	AuthenticatedUser developer;

	@BeforeEach
	void setUp() {
		service = new UserPostService(
				repos, posts, users, techTags, uploads,
				likes, comments, seenPosts, blocks, notifications, authors, rateLimiter, CLOCK);
		developer = new AuthenticatedUser(
				10L, "dev", UserType.DEVELOPER, UserStatus.ACTIVE,
				null, false, false, true, 1L);
	}

	@Test
	void listReposReturnsPersonalPublicReposWithAlreadyPosted() {
		GithubRepo repo = publicRepo(11L, "dev/linker-web");
		when(repos.findPublicByOwner("dev")).thenReturn(List.of(repo));
		when(posts.findPostedRepoIds(10L, List.of(11L))).thenReturn(List.of(11L));

		var response = service.listRepos(developer, null, null);

		assertThat(response.items()).hasSize(1);
		assertThat(response.items().getFirst().repoId()).isEqualTo(11L);
		assertThat(response.items().getFirst().alreadyPosted()).isTrue();
	}

	@Test
	void listReposReturnsEmptyWhenTeamIdPresent() {
		assertThat(service.listRepos(developer, null, 1L).items()).isEmpty();
		verify(repos, never()).findPublicByOwner(any());
		verify(repos, never()).findPublicByOwnerAndQuery(any(), any());
	}

	@Test
	void createPublishesPost() {
		GithubRepo repo = publicRepo(11L, "dev/linker-web");
		User author = User.create("dev", UserType.DEVELOPER);
		ReflectionTestUtils.setField(author, "id", 10L);
		when(repos.findActiveById(11L)).thenReturn(Optional.of(repo));
		when(posts.existsByAuthorIdAndRepoIdAndDeletedAtIsNull(10L, 11L)).thenReturn(false);
		when(users.findById(10L)).thenReturn(Optional.of(author));
		when(posts.save(any(Post.class))).thenAnswer(invocation -> {
			Post post = invocation.getArgument(0);
			ReflectionTestUtils.setField(post, "id", 42L);
			return post;
		});

		var response = service.create(developer, writeRequest(11L, List.of()));

		assertThat(response.id()).isEqualTo(42L);
		ArgumentCaptor<Post> captor = ArgumentCaptor.forClass(Post.class);
		verify(posts).save(captor.capture());
		assertThat(captor.getValue().getSummary()).isEqualTo("한 줄 소개입니다");
	}

	@Test
	void createRejectsDuplicateRepo() {
		GithubRepo repo = publicRepo(11L, "dev/linker-web");
		when(repos.findActiveById(11L)).thenReturn(Optional.of(repo));
		when(posts.existsByAuthorIdAndRepoIdAndDeletedAtIsNull(10L, 11L)).thenReturn(true);

		assertThatThrownBy(() -> service.create(developer, writeRequest(11L, List.of())))
				.isInstanceOf(ApiException.class)
				.satisfies(error -> assertThat(((ApiException) error).getCode()).isEqualTo("REPO_ALREADY_POSTED"));
	}

	@Test
	void createRejectsRepoNotOwnedByCaller() {
		GithubRepo repo = publicRepo(11L, "other/linker-web");
		when(repos.findActiveById(11L)).thenReturn(Optional.of(repo));

		assertThatThrownBy(() -> service.create(developer, writeRequest(11L, List.of())))
				.isInstanceOf(ApiException.class)
				.satisfies(error -> assertThat(((ApiException) error).getCode()).isEqualTo("NOT_FOUND"));
		verify(posts, never()).save(any());
	}

	@Test
	void createRejectsTooManyPhotos() {
		GithubRepo repo = publicRepo(11L, "dev/linker-web");
		when(repos.findActiveById(11L)).thenReturn(Optional.of(repo));
		when(posts.existsByAuthorIdAndRepoIdAndDeletedAtIsNull(10L, 11L)).thenReturn(false);
		List<PostPhotoRequest> photos = java.util.stream.IntStream.rangeClosed(1, PlanLimits.POST_PHOTOS_FREE + 1)
				.mapToObj(i -> new PostPhotoRequest(Integer.toString(i), "https://example.com/" + i))
				.toList();

		assertThatThrownBy(() -> service.create(developer, writeRequest(11L, photos)))
				.isInstanceOf(ApiException.class)
				.satisfies(error -> {
					ApiException api = (ApiException) error;
					assertThat(api.getCode()).isEqualTo("PLAN_LIMIT");
					assertThat(api.getDetail()).containsEntry("reason", "POST_PHOTOS");
				});
	}

	@Test
	void createValidatesUploadedFileOwnership() {
		GithubRepo repo = publicRepo(11L, "dev/linker-web");
		User author = User.create("dev", UserType.DEVELOPER);
		ReflectionTestUtils.setField(author, "id", 10L);
		UploadedFile file = UploadedFile.pending(10L, UploadPurpose.POST, "k", "image/png", 10);
		ReflectionTestUtils.setField(file, "id", 7L);
		file.complete("https://cdn.example/7.png", "image/png", 10, 100, 100);
		when(repos.findActiveById(11L)).thenReturn(Optional.of(repo));
		when(posts.existsByAuthorIdAndRepoIdAndDeletedAtIsNull(10L, 11L)).thenReturn(false);
		when(users.findById(10L)).thenReturn(Optional.of(author));
		when(uploads.requireReady(7L, 10L)).thenReturn(file);
		when(posts.save(any(Post.class))).thenAnswer(invocation -> {
			Post post = invocation.getArgument(0);
			ReflectionTestUtils.setField(post, "id", 42L);
			return post;
		});

		service.create(developer, writeRequest(11L, List.of(new PostPhotoRequest("7", file.getUrl()))));

		verify(uploads).requireReady(7L, 10L);
	}

	@Test
	void editFormRequiresAuthor() {
		Post post = ownedPost();
		when(posts.findDetailedById(42L)).thenReturn(Optional.of(post));

		assertThatThrownBy(() -> service.editForm(
				new AuthenticatedUser(99L, "other", UserType.DEVELOPER, UserStatus.ACTIVE,
						null, false, false, true, 2L),
				42L
		)).isInstanceOf(ApiException.class)
				.satisfies(error -> assertThat(((ApiException) error).getCode()).isEqualTo("FORBIDDEN"));
	}

	@Test
	void updateSetsEditedAt() {
		Post post = ownedPost();
		when(posts.findDetailedById(42L)).thenReturn(Optional.of(post));

		service.update(developer, 42L, writeRequest(null, List.of()));

		assertThat(post.getEditedAt()).isEqualTo(NOW);
		assertThat(post.getSummary()).isEqualTo("한 줄 소개입니다");
	}

	@Test
	void likeIsIdempotentAndNotifiesAuthor() {
		Post post = otherAuthorsPost();
		User actor = User.create("dev", UserType.DEVELOPER);
		ReflectionTestUtils.setField(actor, "id", 10L);
		when(posts.findDetailedById(42L)).thenReturn(Optional.of(post));
		when(blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(anyLong(), anyLong())).thenReturn(false);
		when(likes.existsByPostIdAndUserId(42L, 10L)).thenReturn(false);
		when(users.findById(10L)).thenReturn(Optional.of(actor));

		var first = service.like(developer, 42L);
		assertThat(first.likeCount()).isEqualTo(1);

		when(likes.existsByPostIdAndUserId(42L, 10L)).thenReturn(true);
		var second = service.like(developer, 42L);
		assertThat(second.likeCount()).isEqualTo(1);
		verify(likes, org.mockito.Mockito.times(1)).save(any(PostLike.class));
		verify(notifications).create(any());
	}

	@Test
	void deletePostSoftDeletes() {
		Post post = ownedPost();
		when(posts.findDetailedById(42L)).thenReturn(Optional.of(post));
		when(comments.findByPostIdOrderByIdAsc(42L)).thenReturn(List.of());

		service.deletePost(developer, 42L);

		assertThat(post.getDeletedAt()).isEqualTo(NOW);
		verify(likes).deleteByPostId(42L);
	}

	@Test
	void createCommentRejectsEmpty() {
		when(rateLimiter.tryAcquire(eq("post.comment.day"), eq(10L), eq(PlanLimits.POST_COMMENTS_PER_DAY),
				eq(PlanLimits.POST_COMMENTS_PER_DAY_WINDOW_SECONDS)))
				.thenReturn(new RedisRateLimiter.Decision(true, 0));
		Post post = ownedPost();
		when(posts.findDetailedById(42L)).thenReturn(Optional.of(post));
		when(blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(anyLong(), anyLong())).thenReturn(false);

		assertThatThrownBy(() -> service.createComment(developer, 42L, new CommentWriteRequest("  ", null)))
				.isInstanceOf(ApiException.class)
				.satisfies(error -> assertThat(((ApiException) error).getCode()).isEqualTo("EMPTY"));
	}

	@Test
	void markSeenUpsertsIdempotently() {
		User viewer = User.create("dev", UserType.DEVELOPER);
		ReflectionTestUtils.setField(viewer, "id", 10L);
		Post post = ownedPost();
		when(users.findById(10L)).thenReturn(Optional.of(viewer));
		when(posts.findById(42L)).thenReturn(Optional.of(post));
		when(seenPosts.findByUserIdAndPostId(10L, 42L)).thenReturn(Optional.empty());

		service.markSeen(developer, new FeedSeenRequest(java.util.Arrays.asList(42L, 42L, null)));

		verify(seenPosts).save(any(FeedSeenPost.class));

		FeedSeenPost existing = FeedSeenPost.of(viewer, post, NOW);
		when(seenPosts.findByUserIdAndPostId(10L, 42L)).thenReturn(Optional.of(existing));
		service.markSeen(developer, new FeedSeenRequest(List.of(42L)));
		assertThat(existing.getSeenAt()).isEqualTo(NOW);
		verify(seenPosts).save(any(FeedSeenPost.class));
	}

	@Test
	void withdrawalRemovesOwnPostsAndCommentsOnOtherPosts() {
		User member = User.create("dev", UserType.DEVELOPER);
		ReflectionTestUtils.setField(member, "id", 10L);
		Post own = ownedPost();
		Comment onOwn = Comment.write(own, member, null, "내 글의 댓글");
		ReflectionTestUtils.setField(onOwn, "id", 1L);

		Post other = otherAuthorsPost();
		ReflectionTestUtils.setField(other, "id", 77L);
		other.increaseCommentCount();
		other.increaseCommentCount();
		User someone = User.create("other", UserType.DEVELOPER);
		ReflectionTestUtils.setField(someone, "id", 99L);
		Comment parent = Comment.write(other, someone, null, "원댓글");
		ReflectionTestUtils.setField(parent, "id", 2L);
		Comment mine = Comment.write(other, member, null, "다른 글의 댓글");
		ReflectionTestUtils.setField(mine, "id", 3L);
		Comment threaded = Comment.write(other, member, parent, "답글");
		ReflectionTestUtils.setField(threaded, "id", 4L);

		when(comments.findByAuthorId(10L)).thenReturn(List.of(onOwn, mine, threaded));
		when(comments.countByParentId(3L)).thenReturn(0L);
		when(comments.countByParentId(4L)).thenReturn(1L);
		when(posts.findByAuthor_Id(10L)).thenReturn(List.of(own));
		when(comments.findByPostIdOrderByIdAsc(42L)).thenReturn(List.of(onOwn));

		service.deleteAuthoredContent(10L, NOW);

		verify(comments).delete(mine);
		assertThat(threaded.isDeleted()).isTrue();
		assertThat(threaded.getBody()).isEmpty();
		assertThat(other.getCommentCount()).isZero();
		assertThat(onOwn.isDeleted()).isTrue();
		assertThat(own.getDeletedAt()).isEqualTo(NOW);
		verify(likes).deleteByPostId(42L);
	}

	@Test
	void recommendedUsersEmptyWithoutTechTags() {
		assertThat(service.recommendedUsers(developer).items()).isEmpty();
	}

	private PostWriteRequest writeRequest(Long repoId, List<PostPhotoRequest> photos) {
		return new PostWriteRequest(
				repoId,
				"한 줄 소개입니다",
				"본문입니다",
				photos,
				null,
				List.of("https://example.com"),
				null,
				3,
				List.of()
		);
	}

	private Post ownedPost() {
		User author = User.create("dev", UserType.DEVELOPER);
		ReflectionTestUtils.setField(author, "id", 10L);
		GithubRepo repo = publicRepo(11L, "dev/linker-web");
		Post post = Post.publish(author, repo, null, "old", "body", null, null, null, null, 0, 0);
		ReflectionTestUtils.setField(post, "id", 42L);
		return post;
	}

	private Post otherAuthorsPost() {
		User author = User.create("other", UserType.DEVELOPER);
		ReflectionTestUtils.setField(author, "id", 99L);
		GithubRepo repo = publicRepo(11L, "other/linker-web");
		Post post = Post.publish(author, repo, null, "intro", "body", null, null, null, null, 0, 0);
		ReflectionTestUtils.setField(post, "id", 42L);
		return post;
	}

	private static GithubRepo publicRepo(long id, String fullName) {
		GithubRepo repo = new GithubRepo() {
		};
		ReflectionTestUtils.setField(repo, "id", id);
		ReflectionTestUtils.setField(repo, "githubRepoId", id * 100);
		ReflectionTestUtils.setField(repo, "ownerLogin", fullName.split("/")[0]);
		ReflectionTestUtils.setField(repo, "name", fullName.split("/")[1]);
		ReflectionTestUtils.setField(repo, "fullName", fullName);
		ReflectionTestUtils.setField(repo, "primaryLanguage", "TypeScript");
		ReflectionTestUtils.setField(repo, "stargazersCount", 3);
		ReflectionTestUtils.setField(repo, "forksCount", 1);
		ReflectionTestUtils.setField(repo, "isPrivate", false);
		ReflectionTestUtils.setField(repo, "isFork", false);
		return repo;
	}
}
