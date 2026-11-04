package com.linker.backend.global.security;

import java.io.IOException;

import com.linker.backend.service.PublicAuthService;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class SessionAuthenticationFilter extends OncePerRequestFilter {

	private final SessionCookies cookies;
	private final PublicAuthService auth;

	public SessionAuthenticationFilter(SessionCookies cookies, PublicAuthService auth) {
		this.cookies = cookies;
		this.auth = auth;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
			throws ServletException, IOException {
		String token = cookies.read(request);
		if (token != null) {
			boolean refresh = "/api/v1/public/auth/refresh".equals(request.getRequestURI());
			auth.authenticate(token, !refresh).ifPresent(authenticated -> {
				AuthenticatedUser user = authenticated.user();
				var authentication = new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
				SecurityContextHolder.getContext().setAuthentication(authentication);
				if (authenticated.cookieRewritten()) {
					response.addHeader(HttpHeaders.SET_COOKIE, cookies.write(token));
				}
			});
		}
		filterChain.doFilter(request, response);
	}
}
