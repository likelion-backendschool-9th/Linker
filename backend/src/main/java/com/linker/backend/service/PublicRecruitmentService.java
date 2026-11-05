package com.linker.backend.service;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import com.linker.backend.dto.recruit.response.CursorPage;
import com.linker.backend.dto.recruit.response.RecruitCardResponse;
import com.linker.backend.entity.recruit.RecruitPost;
import com.linker.backend.entity.recruit.RecruitRoleType;
import com.linker.backend.entity.recruit.RecruitStatus;
import com.linker.backend.entity.recruit.RecruitVisibility;
import com.linker.backend.entity.recruit.WorkMode;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.CurrentUser;
import com.linker.backend.repository.moderation.UserBlockRepository;
import com.linker.backend.repository.recruit.RecruitPostRepository;
import com.linker.backend.service.recruit.RecruitCardMapper;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PublicRecruitmentService {

	private final RecruitPostRepository posts;
	private final UserBlockRepository blocks;
	private final RecruitCardMapper cards;

	public PublicRecruitmentService(
			RecruitPostRepository posts,
			UserBlockRepository blocks,
			RecruitCardMapper cards
	) {
		this.posts = posts;
		this.blocks = blocks;
		this.cards = cards;
	}

	@Transactional(readOnly = true)
	public CursorPage<RecruitCardResponse> listOpen(String role, String tech, String mode, String sort, String cursor) {
		RecruitRoleType roleType = parseRole(role);
		WorkMode workMode = parseMode(mode);
		String normalizedTech = blankToNull(tech);
		String normalizedSort = sort == null || sort.isBlank() ? "NEWEST" : sort.trim().toUpperCase(Locale.ROOT);
		if (!normalizedSort.equals("NEWEST") && !normalizedSort.equals("DEADLINE")) {
			throw new ApiException(400, "VALIDATION_ERROR", "정렬을 확인해 주세요");
		}

		Set<Long> excluded = excludedAuthorIds(CurrentUser.optional().orElse(null));
		boolean excludeEmpty = excluded.isEmpty();
		List<Long> excludedIds = excludeEmpty ? List.of(-1L) : List.copyOf(excluded);
		int offset = parseOffset(cursor);

		List<RecruitPost> rows = loadOpen(normalizedSort, roleType, workMode, normalizedTech, excludeEmpty, excludedIds);
		int from = Math.min(offset, rows.size());
		int to = Math.min(from + PlanLimits.RECRUIT_PAGE_SIZE, rows.size());
		List<RecruitCardResponse> items = rows.subList(from, to).stream().map(cards::toCard).toList();
		String next = to < rows.size() ? Integer.toString(to) : null;
		return new CursorPage<>(items, next);
	}

	private List<RecruitPost> loadOpen(
			String sort,
			RecruitRoleType role,
			WorkMode mode,
			String tech,
			boolean excludeEmpty,
			List<Long> excludedIds
	) {
		PageRequest all = PageRequest.of(0, 500);
		if ("DEADLINE".equals(sort)) {
			return posts.findOpenByDeadline(
					RecruitStatus.OPEN,
					RecruitVisibility.VISIBLE,
					role,
					mode,
					tech,
					excludeEmpty,
					excludedIds,
					all
			);
		}
		return posts.findOpenNewest(
				RecruitStatus.OPEN,
				RecruitVisibility.VISIBLE,
				role,
				mode,
				tech,
				excludeEmpty,
				excludedIds,
				all
		);
	}

	private Set<Long> excludedAuthorIds(AuthenticatedUser viewer) {
		if (viewer == null) {
			return Set.of();
		}
		Set<Long> excluded = new HashSet<>();
		excluded.addAll(blocks.findActiveBlockedIds(viewer.userId()));
		excluded.addAll(blocks.findActiveBlockerIds(viewer.userId()));
		return excluded;
	}

	private static RecruitRoleType parseRole(String raw) {
		String value = blankToNull(raw);
		if (value == null) {
			return null;
		}
		try {
			return RecruitRoleType.valueOf(value.trim().toUpperCase(Locale.ROOT));
		}
		catch (IllegalArgumentException exception) {
			throw new ApiException(400, "VALIDATION_ERROR", "역할을 확인해 주세요");
		}
	}

	private static WorkMode parseMode(String raw) {
		String value = blankToNull(raw);
		if (value == null) {
			return null;
		}
		try {
			return WorkMode.valueOf(value.trim().toUpperCase(Locale.ROOT));
		}
		catch (IllegalArgumentException exception) {
			throw new ApiException(400, "VALIDATION_ERROR", "진행 방식을 확인해 주세요");
		}
	}

	private static int parseOffset(String cursor) {
		if (cursor == null || cursor.isBlank()) {
			return 0;
		}
		try {
			int offset = Integer.parseInt(cursor.trim());
			if (offset < 0) {
				throw new NumberFormatException("negative");
			}
			return offset;
		}
		catch (NumberFormatException exception) {
			throw new ApiException(400, "VALIDATION_ERROR", "커서를 확인해 주세요");
		}
	}

	private static String blankToNull(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		return value.trim();
	}
}
