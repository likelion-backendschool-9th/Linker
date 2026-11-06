package com.linker.backend.global.security;

import java.io.IOException;

import com.linker.backend.global.config.ApiPaths;
import com.linker.backend.service.AuthService;

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
	private final AuthService auth;

	public SessionAuthenticationFilter(SessionCookies cookies, AuthService auth) {
		this.cookies = cookies;
		this.auth = auth;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
			throws ServletException, IOException {
		String token = cookies.read(request);
		if (token != null) {
			boolean refresh = ApiPaths.AUTH_REFRESH.equals(request.getRequestURI());
			auth.authenticate(token, !refresh).ifPresent(authenticated -> {
				AuthenticatedUser user = authenticated.user();
				var authentication = new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
				SecurityContextHolder.getContext().setAuthentication(authentication);
				if (authenticated.renewedToken() != null) {
					response.addHeader(HttpHeaders.SET_COOKIE, cookies.write(authenticated.renewedToken()));
				}
			});
		}
		filterChain.doFilter(request, response);
	}
}
