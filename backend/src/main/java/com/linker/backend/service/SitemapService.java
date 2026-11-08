package com.linker.backend.service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

import com.linker.backend.dto.sitemap.SitemapItem;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.post.PostRepository;
import com.linker.backend.repository.recruit.RecruitPostRepository;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Paired entry for {@link com.linker.backend.controller.SitemapController}.
 * Uses the existing content repositories; public indexing never borrows a user's personalized feed.
 */
@Service
public class SitemapService {

	private final UserRepository users;
	private final PostRepository posts;
	private final RecruitPostRepository recruits;

	public SitemapService(UserRepository users, PostRepository posts, RecruitPostRepository recruits) {
		this.users = users;
		this.posts = posts;
		this.recruits = recruits;
	}

	@Transactional(readOnly = true)
	public SitemapPage list(String kind, int page) {
		if (page < 1 || page > 10_000) {
			throw new ApiException(400, "VALIDATION_ERROR", "페이지 값이 올바르지 않아요");
		}
		Kind parsed = Kind.fromPath(kind);
		return new SitemapPage(parsed.pathValue(), page, pageItems(parsed, page, PlanLimits.SITEMAP_PAGE_SIZE));
	}

	private List<SitemapItem> pageItems(Kind kind, int page, int size) {
		return switch (kind) {
			case USERS -> users.findIndexable(PageRequest.of(page - 1, size, Sort.by("id").ascending())).stream()
					.map(user -> new SitemapItem(
							user.getId(),
							"/user/" + URLEncoder.encode(user.getUsername(), StandardCharsets.UTF_8).replace("+", "%20"),
							user.getUpdatedAt()
					))
					.toList();
			case POSTS -> posts.findIndexable(PageRequest.of(page - 1, size));
			case RECRUITS -> recruits.findIndexable(PageRequest.of(page - 1, size));
		};
	}

	enum Kind {
		POSTS,
		RECRUITS,
		USERS;

		static Kind fromPath(String raw) {
			if (raw == null) {
				throw invalid();
			}
			try {
				return Kind.valueOf(raw.toUpperCase(Locale.ROOT));
			}
			catch (IllegalArgumentException exception) {
				throw invalid();
			}
		}

		String pathValue() {
			return name().toLowerCase(Locale.ROOT);
		}

		private static ApiException invalid() {
			return new ApiException(400, "VALIDATION_ERROR", "지원하지 않는 sitemap 종류예요");
		}
	}

	public record SitemapPage(String kind, int page, List<SitemapItem> items) {
	}
}
