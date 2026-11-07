package com.linker.backend.global.security;

import com.linker.backend.global.error.ApiException;

import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Runs before team-role and rate-limit checks so a recruiter is rejected as
 * {@code DEVELOPER_ONLY} instead of a later, more specific denial.
 * Order stays above those checks and below Spring's invocation interceptor.
 */
@Aspect
@Component
@Order(0)
public class DeveloperOnlyAspect {

	@Before("@annotation(com.linker.backend.global.security.DeveloperOnly)")
	public void check() {
		AuthenticatedUser user = CurrentUser.require();
		boolean developer = user.getAuthorities().stream()
				.anyMatch(authority -> Authorities.DEVELOPER.equals(authority.getAuthority()));
		if (!developer) {
			throw new ApiException(403, "DEVELOPER_ONLY", "개발자만 사용할 수 있어요");
		}
	}
}
