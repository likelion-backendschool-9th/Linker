package com.linker.backend.service.recruiter;

import java.net.URI;
import java.time.Clock;
import java.time.Instant;

import com.linker.backend.dto.account.request.RecruiterProfileUpdateRequest;
import com.linker.backend.dto.account.response.RecruiterProfileResponse;
import com.linker.backend.entity.account.RecruiterProfile;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.account.RecruiterProfileRepository;
import com.linker.backend.repository.account.UserRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Paired entry for {@link com.linker.backend.controller.recruiter.RecruiterAccountController}. */
@Service
public class RecruiterAccountService {

	private final UserRepository users;
	private final RecruiterProfileRepository profiles;
	private final Clock clock;

	public RecruiterAccountService(UserRepository users, RecruiterProfileRepository profiles, Clock clock) {
		this.users = users;
		this.profiles = profiles;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public RecruiterProfileResponse profile(AuthenticatedUser principal) {
		User user = requireRecruiter(principal);
		return response(user, requireProfile(user));
	}

	@Transactional
	public RecruiterProfileResponse update(AuthenticatedUser principal, RecruiterProfileUpdateRequest request) {
		User user = requireRecruiter(principal);
		RecruiterProfile profile = requireProfile(user);
		if (request == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		}
		String name = bounded(
				request.name(),
				PlanLimits.PROFILE_DISPLAY_NAME_MIN,
				PlanLimits.PROFILE_DISPLAY_NAME_MAX,
				"이름을 입력해 주세요.",
				"이름은 " + PlanLimits.PROFILE_DISPLAY_NAME_MAX + "자 이내로 입력해 주세요.");
		String company = bounded(
				request.company(),
				PlanLimits.RECRUITER_COMPANY_MIN,
				PlanLimits.RECRUITER_COMPANY_MAX,
				"회사명을 입력해 주세요.",
				"회사명은 " + PlanLimits.RECRUITER_COMPANY_MAX + "자 이내로 입력해 주세요.");
		String jobTitle = bounded(
				request.jobTitle(),
				1,
				PlanLimits.RECRUITER_JOB_TITLE_MAX,
				"직함을 입력해 주세요.",
				"직함은 " + PlanLimits.RECRUITER_JOB_TITLE_MAX + "자 이내로 입력해 주세요.");
		user.changeDisplayName(name);
		user.touch(Instant.now(clock));
		profile.update(company, jobTitle, optionalHttps(request.websiteUrl()));
		return response(user, profile);
	}

	private RecruiterProfile requireProfile(User user) {
		return profiles.findByUser_Id(user.getId())
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "프로필을 찾을 수 없어요"));
	}

	private User requireRecruiter(AuthenticatedUser principal) {
		if (principal == null) {
			throw new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요");
		}
		User user = users.findById(principal.userId())
				.orElseThrow(() -> new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요"));
		if (user.getUserType() != UserType.RECRUITER || user.getStatus() == UserStatus.DELETED || user.getDeletedAt() != null) {
			throw new ApiException(403, "FORBIDDEN", "채용 담당자만 쓸 수 있어요");
		}
		return user;
	}

	private static RecruiterProfileResponse response(User user, RecruiterProfile profile) {
		String website = profile.getCompanyUrl();
		String email = user.getEmail();
		return new RecruiterProfileResponse(
				"RECRUITER",
				user.visibleName(),
				profile.getCompanyName(),
				profile.getJobTitle(),
				website == null ? "" : website,
				email == null ? "" : email);
	}

	private static String bounded(String raw, int min, int max, String missing, String tooLong) {
		String value = raw == null ? "" : raw.trim();
		if (value.length() < min) {
			throw new ApiException(400, "VALIDATION_ERROR", missing);
		}
		if (value.length() > max) {
			throw new ApiException(400, "VALIDATION_ERROR", tooLong);
		}
		return value;
	}

	private static String optionalHttps(String raw) {
		if (raw == null || raw.isBlank()) {
			return null;
		}
		String value = raw.trim();
		try {
			URI uri = URI.create(value);
			if ("https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && !uri.getHost().isBlank() && value.length() <= 2048) {
				return value;
			}
		}
		catch (IllegalArgumentException exception) {
			// The message below covers a malformed website.
		}
		throw new ApiException(400, "VALIDATION_ERROR", "회사 웹사이트는 https 주소로 입력해 주세요.");
	}
}
