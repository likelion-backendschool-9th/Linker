package com.linker.backend.global.security;

import com.linker.backend.global.error.ErrorResponseWriter;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;

@Configuration
public class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(
			HttpSecurity http,
			SessionAuthenticationFilter sessionAuthenticationFilter,
			AccountStateFilter accountStateFilter,
			PublicRateLimitFilter publicRateLimitFilter,
			OriginCheckFilter originCheckFilter,
			ErrorResponseWriter errors
	) throws Exception {
		http
				.csrf(AbstractHttpConfigurer::disable)
				.httpBasic(AbstractHttpConfigurer::disable)
				.formLogin(AbstractHttpConfigurer::disable)
				.logout(AbstractHttpConfigurer::disable)
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.authorizeHttpRequests(auth -> auth
						.requestMatchers("/api/v1/public/**").permitAll()
						.requestMatchers("/api/v1/webhook/**").permitAll()
						.requestMatchers("/ws", "/ws/**").permitAll()
						.requestMatchers("/api/v1/user/**").authenticated()
						.requestMatchers("/api/v1/recruiter/**").hasRole("RECRUITER")
						.requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
						.anyRequest().denyAll())
				.exceptionHandling(handling -> handling
						.authenticationEntryPoint((request, response, exception) ->
								errors.write(response, 401, "LOGIN_REQUIRED", "로그인이 필요해요", null))
						.accessDeniedHandler((request, response, exception) ->
								errors.write(response, 403, "FORBIDDEN", "이 기능을 사용할 수 없어요", null)))
				.addFilterBefore(sessionAuthenticationFilter, AnonymousAuthenticationFilter.class)
				.addFilterAfter(publicRateLimitFilter, SessionAuthenticationFilter.class)
				.addFilterAfter(accountStateFilter, PublicRateLimitFilter.class)
				.addFilterAfter(originCheckFilter, AccountStateFilter.class);
		return http.build();
	}

	@Bean
	UserDetailsService userDetailsService() {
		return username -> {
			throw new UsernameNotFoundException("unsupported");
		};
	}

	@Bean
	FilterRegistrationBean<SessionAuthenticationFilter> sessionAuthenticationRegistration(SessionAuthenticationFilter filter) {
		return disabled(filter);
	}

	@Bean
	FilterRegistrationBean<PublicRateLimitFilter> publicRateLimitRegistration(PublicRateLimitFilter filter) {
		return disabled(filter);
	}

	@Bean
	FilterRegistrationBean<AccountStateFilter> accountStateRegistration(AccountStateFilter filter) {
		return disabled(filter);
	}

	@Bean
	FilterRegistrationBean<OriginCheckFilter> originCheckRegistration(OriginCheckFilter filter) {
		return disabled(filter);
	}

	private static <T extends jakarta.servlet.Filter> FilterRegistrationBean<T> disabled(T filter) {
		FilterRegistrationBean<T> registration = new FilterRegistrationBean<>(filter);
		registration.setEnabled(false);
		return registration;
	}
}
