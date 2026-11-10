package com.linker.backend.service.recruiter;

import java.time.Clock;
import java.time.Instant;

import com.linker.backend.dto.auth.request.RecruiterPasswordUpdateRequest;
import com.linker.backend.entity.account.AuthIdentity;
import com.linker.backend.entity.account.type.AuthProvider;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.account.AuthIdentityRepository;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.account.UserSessionRepository;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Paired entry for {@link com.linker.backend.controller.recruiter.AuthController}. */
@Service("recruiterAuthService")
public class AuthService {

	private final UserRepository users;
	private final AuthIdentityRepository identities;
	private final UserSessionRepository sessions;
	private final PasswordEncoder passwords;
	private final Clock clock;

	public AuthService(
			UserRepository users,
			AuthIdentityRepository identities,
			UserSessionRepository sessions,
			PasswordEncoder passwords,
			Clock clock) {
		this.users = users;
		this.identities = identities;
		this.sessions = sessions;
		this.passwords = passwords;
		this.clock = clock;
	}

	@Transactional
	public void changePassword(AuthenticatedUser principal, RecruiterPasswordUpdateRequest request) {
		User user = requireRecruiter(principal);
		if (request == null || request.currentPassword() == null || request.currentPassword().isBlank()) {
			throw new ApiException(400, "VALIDATION_ERROR", "현재 비밀번호를 입력해 주세요.");
		}
		requirePassword(request.newPassword());
		AuthIdentity identity = identities.findByUserIdAndProvider(user.getId(), AuthProvider.EMAIL)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));
		if (identity.getPasswordHash() == null || !passwords.matches(request.currentPassword(), identity.getPasswordHash())) {
			throw new ApiException(400, "INVALID_PASSWORD", "현재 비밀번호가 맞지 않아요");
		}
		Instant now = Instant.now(clock);
		identity.changePassword(passwords.encode(request.newPassword()));
		sessions.revokeOthers(user.getId(), principal.sessionId(), now);
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

	private static void requirePassword(String password) {
		boolean letter = password != null && password.chars().anyMatch(ch -> (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z'));
		boolean digit = password != null && password.chars().anyMatch(Character::isDigit);
		if (password == null || password.length() < PlanLimits.RECRUITER_PASSWORD_MIN || password.length() > PlanLimits.RECRUITER_PASSWORD_MAX || !letter || !digit) {
			throw new ApiException(400, "PASSWORD_WEAK", "비밀번호는 8자 이상, 영문과 숫자를 포함해야 해요");
		}
	}
}
