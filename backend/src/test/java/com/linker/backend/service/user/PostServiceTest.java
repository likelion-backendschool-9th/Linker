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
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.file.UploadedFile;
import com.linker.backend.entity.file.type.UploadPurpose;
import com.linker.backend.entity.github.GithubRepo;
import com.linker.backend.entity.post.Post;
import com.linker.backend.entity.post.PostLike;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.RedisRateLimiter;
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
import com.linker.backend.repository.profile.TechTagRepository;
import com.linker.backend.repository.team.TeamRepository;
import com.linker.backend.dto.recruit.mapper.RecruitCardMapper;
import com.linker.backend.dto.team.response.TeamConnectionView.LinkedRepo;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;

@ExtendWith(MockitoExtension.class)
class PostServiceTest {

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
	UploadService uploads;
	@Mock
	PostLikeRepository likes;
	@Mock
	CommentRepository comments;
	@Mock
	FeedSeenPostRepository seenPosts;
	@Mock
	PinnedPostRepository pins;
	@Mock
	UserBlockRepository blocks;
	@Mock
	ProMembership pro;
	@Mock
	NotificationService notifications;
	@Mock
	RecruitCardMapper authors;
	@Mock
	RedisRateLimiter rateLimiter;
	@Mock
	TeamRepository teams;
	@Mock
	GithubRepoSource github;
	@Mock
	PlatformTransactionManager transactions;

	PostService service;
	AuthenticatedUser developer;

	@BeforeEach
	void setUp() {
		service = new PostService(
				repos, posts, users, techTags, uploads,
				likes, comments, seenPosts, pins, blocks, notifications, authors, rateLimiter, pro, teams,
				github, transactions, CLOCK);
		developer = new AuthenticatedUser(
				10L, "dev", UserType.DEVELOPER, UserStatus.ACTIVE,
				null, false, false, true, 1L);
	}

	@Test
	void listReposSyncsMyPublicReposFromGithubIncludingForks() {
		var own = githubRepo(1100L, "dev/linker-web", false);
		var fork = githubRepo(1200L, "dev/react", true);
		when(github.ownedPublicRepositories(10L, "dev")).thenReturn(List.of(own, fork));
		when(teams.cacheRepo(own, NOW)).thenReturn(11L);
		when(teams.cacheRepo(fork, NOW)).thenReturn(12L);
		GithubRepo forkRow = publicRepo(12L, "dev/react");
		ReflectionTestUtils.setField(forkRow, "isFork", true);
		when(repos.findAllById(List.of(11L, 12L)))
				.thenReturn(List.of(forkRow, publicRepo(11L, "dev/linker-web")));
		when(posts.findPostedRepoIds(10L, List.of(11L, 12L))).thenReturn(List.of(11L));

		var response = service.listRepos(developer, " ", null);

		assertThat(response.items()).extracting(item -> item.fullName())
				.containsExactly("dev/linker-web", "dev/react");
		assertThat(response.items().getFirst().alreadyPosted()).isTrue();
		assertThat(response.items().get(1).isFork()).isTrue();
		verify(repos, never()).findPublicByOwner(any());
	}

	@Test
	void listReposFallsBackToCacheWhenGithubIsUnavailable() {
		when(github.ownedPublicRepositories(10L, "dev"))
				.thenThrow(new ApiException(503, "SERVICE_UNAVAILABLE", "GitHub에 연결하지 못했어요"));
		GithubRepo repo = publicRepo(11L, "dev/linker-web");
		when(repos.findPublicByOwner("dev")).thenReturn(List.of(repo));
		when(posts.findPostedRepoIds(10L, List.of(11L))).thenReturn(List.of(11L));

		var response = service.listRepos(developer, null, null);

		assertThat(response.items()).hasSize(1);
		assertThat(response.items().getFirst().repoId()).isEqualTo(11L);
		assertThat(response.items().getFirst().alreadyPosted()).isTrue();
		verify(teams, never()).cacheRepo(any(), any());
	}

	@Test
	void listReposAsksToLogInAgainWhenTheGithubTokenIsGone() {
		when(github.ownedPublicRepositories(10L, "dev"))
				.thenThrow(new ApiException(401, "LOGIN_REQUIRED", "GitHub에 다시 로그인해 주세요"));

		assertThatThrownBy(() -> service.listRepos(developer, null, null))
				.isInstanceOf(ApiException.class)
				.extracting("code")
				.isEqualTo("LOGIN_REQUIRED");
	}

	@Test
	void listReposSearchReadsTheCacheWithoutCallingGithub() {
		GithubRepo repo = publicRepo(11L, "dev/linker-web");
		when(repos.findPublicByOwnerAndQuery("dev", "web")).thenReturn(List.of(repo));
		when(posts.findPostedRepoIds(10L, List.of(11L))).thenReturn(List.of());

		var response = service.listRepos(developer, "web", null);

		assertThat(response.items()).hasSize(1);
		verify(github, never()).ownedPublicRepositories(anyLong(), any());
	}

	@Test
	void listReposUsesLinkedTeamReposWhenTeamIdPresent() {
		GithubRepo repo = publicRepo(11L, "org/linker-web");
		when(teams.findLinkedRepos(1L)).thenReturn(List.of(new LinkedRepo(11L, 99L, "org", "linker-web")));
		when(repos.findAllById(List.of(11L))).thenReturn(List.of(repo));
		when(posts.findPostedRepoIds(10L, List.of(11L))).thenReturn(List.of());

		var response = service.listRepos(developer, null, 1L);

		assertThat(response.items()).hasSize(1);
		assertThat(response.items().getFirst().repoId()).isEqualTo(11L);
		assertThat(response.items().getFirst().teamId()).isEqualTo(1L);
		verify(repos, never()).findPublicByOwner(any());
		verify(github, never()).ownedPublicRepositories(anyLong(), any());
	}

	@Test
	void createPublishesPost() {
		GithubRepo repo = publicRepo(11L, "dev/linker-web");
		User author = User.create("dev", UserType.DEVELOPER);
		ReflectionTestUtils.setField(author, "id", 10L);
		when(repos.findActiveById(11L)).thenReturn(Optional.of(repo));
		when(posts.existsByAuthorIdAndRepoIdAndDeletedAtIsNull(10L, 11L)).thenReturn(false);
		when(users.lockById(10L)).thenReturn(Optional.of(author));
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
	void createRejectsTheEleventhPublishedPostOfTheDay() {
		GithubRepo repo = publicRepo(11L, "dev/linker-web");
		User author = User.create("dev", UserType.DEVELOPER);
		ReflectionTestUtils.setField(author, "id", 10L);
		when(repos.findActiveById(11L)).thenReturn(Optional.of(repo));
		when(posts.existsByAuthorIdAndRepoIdAndDeletedAtIsNull(10L, 11L)).thenReturn(false);
		when(users.lockById(10L)).thenReturn(Optional.of(author));
		Instant oldest = NOW.minusSeconds(3_600);
		List<Instant> ten = java.util.stream.IntStream.range(0, PlanLimits.POSTS_PER_DAY)
				.mapToObj(i -> oldest.plusSeconds(i * 60L))
				.toList();
		when(posts.findCreatedAtSince(10L, NOW.minusSeconds(PlanLimits.POSTS_PER_DAY_WINDOW_SECONDS)))
				.thenReturn(ten);

		assertThatThrownBy(() -> service.create(developer, writeRequest(11L, List.of())))
				.isInstanceOf(ApiException.class)
				.satisfies(error -> {
					ApiException api = (ApiException) error;
					assertThat(api.getStatus()).isEqualTo(429);
					assertThat(api.getCode()).isEqualTo("RATE_LIMITED");
					// The oldest of the ten leaves the 24h window 23 hours from now
					assertThat(api.getDetail()).containsEntry("retryAfterSeconds", 23L * 3_600);
				});
		verify(posts, never()).save(any());
	}

	@Test
	void rejectedPublishesDoNotTouchTheDailyLimit() {
		GithubRepo repo = publicRepo(11L, "dev/linker-web");
		when(repos.findActiveById(11L)).thenReturn(Optional.of(repo));
		when(posts.existsByAuthorIdAndRepoIdAndDeletedAtIsNull(10L, 11L)).thenReturn(true);

		assertThatThrownBy(() -> service.create(developer, writeRequest(11L, List.of())))
				.isInstanceOf(ApiException.class);
		verify(posts, never()).findCreatedAtSince(anyLong(), any());
		verify(rateLimiter, never()).tryAcquire(any(), anyLong(), org.mockito.ArgumentMatchers.anyInt(),
				org.mockito.ArgumentMatchers.anyInt());
	}

	@Test
	void createRejectsEmojiInText() {
		GithubRepo repo = publicRepo(11L, "dev/linker-web");
		when(repos.findActiveById(11L)).thenReturn(Optional.of(repo));
		when(posts.existsByAuthorIdAndRepoIdAndDeletedAtIsNull(10L, 11L)).thenReturn(false);
		var withEmoji = new PostWriteRequest(11L, "한 줄 소개 🚀", "본문", List.of(), null, List.of(), null, null,
				List.of());

		assertThatThrownBy(() -> service.create(developer, withEmoji))
				.isInstanceOf(ApiException.class)
				.satisfies(error -> {
					ApiException api = (ApiException) error;
					assertThat(api.getCode()).isEqualTo("VALIDATION_ERROR");
					assertThat(api.getMessage()).isEqualTo("이모지는 입력할 수 없어요.");
				});
		verify(posts, never()).save(any());
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
	void proRaisesThePhotoLimitToTen() {
		GithubRepo repo = publicRepo(11L, "dev/linker-web");
		when(repos.findActiveById(11L)).thenReturn(Optional.of(repo));
		when(posts.existsByAuthorIdAndRepoIdAndDeletedAtIsNull(10L, 11L)).thenReturn(false);
		when(pro.active(10L, CLOCK.instant())).thenReturn(true);
		List<PostPhotoRequest> six = photos(PlanLimits.POST_PHOTOS_FREE + 1);
		List<PostPhotoRequest> eleven = photos(PlanLimits.POST_PHOTOS_PRO + 1);

		// Six photos pass the Pro cap; whatever fails later (unmocked uploads) is not the plan limit.
		Throwable sixResult = org.assertj.core.api.Assertions.catchThrowable(
				() -> service.create(developer, writeRequest(11L, six)));
		if (sixResult instanceof ApiException api) {
			assertThat(api.getCode()).isNotEqualTo("PLAN_LIMIT");
		}
		assertThatThrownBy(() -> service.create(developer, writeRequest(11L, eleven)))
				.isInstanceOf(ApiException.class)
				.satisfies(error -> {
					ApiException api = (ApiException) error;
					assertThat(api.getCode()).isEqualTo("PLAN_LIMIT");
					assertThat(api.getMessage()).isEqualTo("사진은 10장까지 올릴 수 있어요.");
				});
	}

	private static List<PostPhotoRequest> photos(int count) {
		return java.util.stream.IntStream.rangeClosed(1, count)
				.mapToObj(i -> new PostPhotoRequest(Integer.toString(i), "https://example.com/" + i))
				.toList();
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
		when(users.lockById(10L)).thenReturn(Optional.of(author));
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

		assertThatThrownBy(() -> service.createComment(developer, 42L, new CommentWriteRequest("  ")))
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
		Comment mine = Comment.write(other, member, null, "다른 글의 댓글");
		ReflectionTestUtils.setField(mine, "id", 3L);

		when(comments.findByAuthorId(10L)).thenReturn(List.of(onOwn, mine));
		when(posts.findByAuthor_Id(10L)).thenReturn(List.of(own));
		when(comments.findByPostIdOrderByIdAsc(42L)).thenReturn(List.of(onOwn));

		service.deleteAuthoredContent(10L, NOW);

		verify(comments).delete(mine);
		assertThat(other.getCommentCount()).isEqualTo(0);
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

	private static GithubTeamSource.Repository githubRepo(long githubId, String fullName, boolean fork) {
		String[] parts = fullName.split("/");
		return new GithubTeamSource.Repository(githubId, parts[0], parts[1], fullName, null, "TypeScript",
				3, 1, "https://github.com/" + fullName, false, fork, null, "main");
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
