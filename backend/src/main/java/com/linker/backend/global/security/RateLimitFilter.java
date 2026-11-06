package com.linker.backend.global.security;

import java.io.IOException;
import java.util.Map;

import com.linker.backend.global.config.ApiPaths;
import com.linker.backend.global.config.LinkerProperties;
import com.linker.backend.global.error.ErrorResponseWriter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

	private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

	private final ReadRateLimiter limiter;
	private final ErrorResponseWriter errors;
	private final boolean trustForwardedFor;

	public RateLimitFilter(ReadRateLimiter limiter, ErrorResponseWriter errors, LinkerProperties properties) {
		this.limiter = limiter;
		this.errors = errors;
		this.trustForwardedFor = properties.security().trustForwardedFor();
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
			throws ServletException, IOException {
		if (!counts(request) || signedIn()) {
			filterChain.doFilter(request, response);
			return;
		}
		try {
			ReadRateLimiter.Decision decision = limiter.decide(ClientAddress.ip(request, trustForwardedFor));
			if (!decision.allowed()) {
				response.setHeader("Retry-After", Long.toString(decision.retryAfterSeconds()));
				errors.write(response, 429, "RATE_LIMITED", "요청이 너무 많아요. 잠시 후 다시 시도해 주세요",
						Map.of("retryAfterSeconds", decision.retryAfterSeconds()));
				return;
			}
		}
		catch (RuntimeException exception) {
			log.warn("public rate limit unavailable: {}", exception.getClass().getSimpleName());
			errors.write(response, 503, "SERVICE_UNAVAILABLE", "잠시 후 다시 시도해 주세요", null);
			return;
		}
		filterChain.doFilter(request, response);
	}

	private boolean counts(HttpServletRequest request) {
		if (!request.getRequestURI().startsWith(ApiPaths.PUBLIC + "/")) {
			return false;
		}
		return HttpMethod.GET.matches(request.getMethod()) || HttpMethod.HEAD.matches(request.getMethod());
	}

	private boolean signedIn() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		return authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser;
	}
}
