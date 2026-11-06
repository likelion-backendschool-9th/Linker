package com.linker.backend.global.security;

import java.io.IOException;

import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.global.error.ErrorResponseWriter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class AccountStateFilter extends OncePerRequestFilter {

	private final ErrorResponseWriter errors;

	public AccountStateFilter(ErrorResponseWriter errors) {
		this.errors = errors;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
			throws ServletException, IOException {
		if (safe(request)
				|| "/api/v1/public/auth/refresh".equals(request.getRequestURI())
				|| "/api/v1/user/auth/logout".equals(request.getRequestURI())
				|| "/api/v1/user/me/withdrawal".equals(request.getRequestURI())
				|| "/api/v1/admin/otp/verify".equals(request.getRequestURI())) {
			filterChain.doFilter(request, response);
			return;
		}
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser user
				&& user.status() == UserStatus.SUSPENDED) {
			errors.write(response, 403, "SUSPENDED", "정지된 계정은 이 기능을 쓸 수 없어요", null);
			return;
		}
		filterChain.doFilter(request, response);
	}

	private boolean safe(HttpServletRequest request) {
		String method = request.getMethod();
		return HttpMethod.GET.matches(method) || HttpMethod.HEAD.matches(method) || HttpMethod.OPTIONS.matches(method);
	}
}
