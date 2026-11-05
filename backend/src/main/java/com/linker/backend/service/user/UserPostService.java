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

import com.linker.backend.dto.post.request.PostPeriodRequest;
import com.linker.backend.dto.post.request.PostPhotoRequest;
import com.linker.backend.dto.post.request.PostWriteRequest;
import com.linker.backend.dto.post.response.EditorRepoListResponse;
import com.linker.backend.dto.post.response.EditorRepoResponse;
import com.linker.backend.dto.post.response.PostEditFormResponse;
import com.linker.backend.dto.post.response.PostIdResponse;
import com.linker.backend.dto.post.response.PostPeriodResponse;
import com.linker.backend.dto.post.response.PostPhotoResponse;
import com.linker.backend.dto.post.response.RepoSummaryResponse;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.file.UploadedFile;
import com.linker.backend.entity.github.GithubRepo;
import com.linker.backend.entity.post.Post;
import com.linker.backend.entity.post.PostDemoLink;
import com.linker.backend.entity.post.PostImage;
import com.linker.backend.entity.post.PostTag;
import com.linker.backend.entity.profile.TechTag;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.github.GithubRepoRepository;
import com.linker.backend.repository.post.PostRepository;
import com.linker.backend.repository.profile.TechTagRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserPostService {

	private final GithubRepoRepository repos;
	private final PostRepository posts;
	private final UserRepository users;
	private final TechTagRepository techTags;
	private final UserUploadService uploads;
	private final Clock clock;

	public UserPostService(
			GithubRepoRepository repos,
			PostRepository posts,
			UserRepository users,
			TechTagRepository techTags,
			UserUploadService uploads,
			Clock clock
	) {
		this.repos = repos;
		this.posts = posts;
		this.users = users;
		this.techTags = techTags;
		this.uploads = uploads;
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
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "삭제되었거나 볼 수 없는 콘텐츠예요"));
		if (post.getAuthor().getId() != userId) {
			throw new ApiException(403, "FORBIDDEN", "내 게시물이 아니에요");
		}
		return post;
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
