package com.linker.backend.service.user;

import java.util.List;
import java.util.Locale;

import com.linker.backend.dto.recruit.response.CursorPage;
import com.linker.backend.dto.recruit.response.MyApplicationResponse;
import com.linker.backend.dto.recruit.response.RecruitCardResponse;
import com.linker.backend.entity.recruit.Application;
import com.linker.backend.entity.recruit.ApplicationStatus;
import com.linker.backend.entity.recruit.RecruitPost;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.recruit.ApplicationRepository;
import com.linker.backend.repository.recruit.RecruitPostRepository;
import com.linker.backend.service.recruit.RecruitCardMapper;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserRecruitmentService {

	private final RecruitPostRepository posts;
	private final ApplicationRepository applications;
	private final RecruitCardMapper cards;

	public UserRecruitmentService(
			RecruitPostRepository posts,
			ApplicationRepository applications,
			RecruitCardMapper cards
	) {
		this.posts = posts;
		this.applications = applications;
		this.cards = cards;
	}

	@Transactional(readOnly = true)
	public CursorPage<RecruitCardResponse> myRecruits(AuthenticatedUser user, String cursor) {
		int offset = parseOffset(cursor);
		List<RecruitPost> rows = posts.findMine(user.userId(), PageRequest.of(0, 500));
		int from = Math.min(offset, rows.size());
		int to = Math.min(from + PlanLimits.RECRUIT_PAGE_SIZE, rows.size());
		List<RecruitCardResponse> items = rows.subList(from, to).stream().map(cards::toCard).toList();
		String next = to < rows.size() ? Integer.toString(to) : null;
		return new CursorPage<>(items, next);
	}

	@Transactional(readOnly = true)
	public CursorPage<MyApplicationResponse> myApplications(AuthenticatedUser user, String status, String cursor) {
		ApplicationStatus filter = parseStatus(status);
		int offset = parseOffset(cursor);
		List<Application> rows = applications.findMine(
				user.userId(), filter, ApplicationStatus.CANCELED, PageRequest.of(0, 500));
		int from = Math.min(offset, rows.size());
		int to = Math.min(from + PlanLimits.RECRUIT_PAGE_SIZE, rows.size());
		List<MyApplicationResponse> items = rows.subList(from, to).stream()
				.map(application -> new MyApplicationResponse(
						application.getId(),
						application.getStatus().name(),
						application.getCreatedAt().toString(),
						application.getRecruitRole().getRole().label(),
						cards.toCard(application.getRecruitPost()),
						null
				))
				.toList();
		String next = to < rows.size() ? Integer.toString(to) : null;
		return new CursorPage<>(items, next);
	}

	@Transactional
	public void cancelApplication(AuthenticatedUser user, long applicationId) {
		Application application = applications.findDetailedById(applicationId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "지원 내역을 찾지 못했어요"));
		if (application.getApplicant().getId() != user.userId()) {
			throw new ApiException(404, "NOT_FOUND", "지원 내역을 찾지 못했어요");
		}
		if (application.getStatus() != ApplicationStatus.PENDING) {
			throw new ApiException(409, "NOT_PENDING", "검토 중인 지원만 취소할 수 있어요");
		}
		application.cancel();
	}

	private static ApplicationStatus parseStatus(String raw) {
		if (raw == null || raw.isBlank()) {
			return null;
		}
		String value = raw.trim().toUpperCase(Locale.ROOT);
		if ("CANCELLED".equals(value)) {
			value = "CANCELED";
		}
		try {
			ApplicationStatus status = ApplicationStatus.valueOf(value);
			if (status == ApplicationStatus.CANCELED) {
				throw new ApiException(400, "VALIDATION_ERROR", "지원 상태를 확인해 주세요");
			}
			return status;
		}
		catch (IllegalArgumentException exception) {
			throw new ApiException(400, "VALIDATION_ERROR", "지원 상태를 확인해 주세요");
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
}
