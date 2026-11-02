package com.linker.backend.global.security;

import java.io.IOException;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import com.linker.backend.global.config.LinkerProperties;
import com.linker.backend.global.error.ErrorResponseWriter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Origin checks stay off until allowed browser origins are decided.
 * Enable with {@code linker.security.enforce-origin=true}.
 */
@Component
public class OriginCheckFilter extends OncePerRequestFilter {

	private final ErrorResponseWriter errors;
	private final boolean enforced;
	private final Set<String> allowedOrigins;

	public OriginCheckFilter(ErrorResponseWriter errors, LinkerProperties properties) {
		this.errors = errors;
		this.enforced = properties.security().enforceOrigin();
		String configured = properties.security().allowedOrigins();
		if (configured == null || configured.isBlank()) {
			this.allowedOrigins = Set.of();
		}
		else {
			this.allowedOrigins = Arrays.stream(configured.split(","))
					.map(String::trim)
					.filter(value -> !value.isEmpty())
					.collect(Collectors.toUnmodifiableSet());
		}
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
			throws ServletException, IOException {
		if (!enforced || safe(request) || request.getRequestURI().startsWith("/api/v1/webhook/")) {
			filterChain.doFilter(request, response);
			return;
		}
		if (!allowed(request)) {
			errors.write(response, 403, "VALIDATION_ERROR", "요청 출처를 확인할 수 없어요", null);
			return;
		}
		filterChain.doFilter(request, response);
	}

	private boolean allowed(HttpServletRequest request) {
		String origin = request.getHeader("Origin");
		if (origin != null && allowedOrigins.contains(origin)) {
			return true;
		}
		String referer = request.getHeader("Referer");
		if (referer == null) {
			return false;
		}
		return allowedOrigins.stream().anyMatch(referer::startsWith);
	}

	private boolean safe(HttpServletRequest request) {
		String method = request.getMethod();
		return HttpMethod.GET.matches(method) || HttpMethod.HEAD.matches(method) || HttpMethod.OPTIONS.matches(method);
	}
}
