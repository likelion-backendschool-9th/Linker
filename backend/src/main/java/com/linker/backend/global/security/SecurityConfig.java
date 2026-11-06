package com.linker.backend.global.security;

import java.util.Arrays;
import java.util.List;

import com.linker.backend.global.config.ApiPaths;
import com.linker.backend.global.config.LinkerProperties;
import com.linker.backend.global.error.ErrorResponseWriter;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {

	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}

	@Bean
	SecurityFilterChain securityFilterChain(
			HttpSecurity http,
			LinkerProperties properties,
			SessionAuthenticationFilter sessionAuthenticationFilter,
			AccountStateFilter accountStateFilter,
			RateLimitFilter publicRateLimitFilter,
			OriginCheckFilter originCheckFilter,
			ErrorResponseWriter errors
	) throws Exception {
		http
				.cors(cors -> cors.configurationSource(corsConfigurationSource(properties)))
				.csrf(AbstractHttpConfigurer::disable)
				.httpBasic(AbstractHttpConfigurer::disable)
				.formLogin(AbstractHttpConfigurer::disable)
				.logout(AbstractHttpConfigurer::disable)
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.authorizeHttpRequests(auth -> auth
						.requestMatchers("/v3/api-docs", "/v3/api-docs/**", "/v3/api-docs.yaml").permitAll()
						.requestMatchers(ApiPaths.PUBLIC + "/**").permitAll()
						.requestMatchers(ApiPaths.WEBHOOK + "/**").permitAll()
						.requestMatchers("/ws", "/ws/**").permitAll()
						.requestMatchers(ApiPaths.USER + "/**").authenticated()
						.requestMatchers(ApiPaths.RECRUITER + "/**").hasRole("RECRUITER")
						.requestMatchers(HttpMethod.POST, ApiPaths.ADMIN_OTP_VERIFY).authenticated()
						.requestMatchers(ApiPaths.ADMIN + "/**").hasRole("ADMIN")
						.anyRequest().denyAll())
				.exceptionHandling(handling -> handling
						.authenticationEntryPoint((request, response, exception) ->
								errors.write(response, 401, "LOGIN_REQUIRED", "로그인이 필요해요", null))
						.accessDeniedHandler((request, response, exception) ->
								errors.write(response, 403, "FORBIDDEN", "이 기능을 사용할 수 없어요", null)))
				.addFilterBefore(sessionAuthenticationFilter, AnonymousAuthenticationFilter.class)
				.addFilterAfter(publicRateLimitFilter, SessionAuthenticationFilter.class)
				.addFilterAfter(accountStateFilter, RateLimitFilter.class)
				.addFilterAfter(originCheckFilter, AccountStateFilter.class);
		return http.build();
	}

	private static CorsConfigurationSource corsConfigurationSource(LinkerProperties properties) {
		CorsConfiguration configuration = new CorsConfiguration();
		List<String> origins = Arrays.stream(properties.security().allowedOrigins().split(","))
				.map(String::trim)
				.filter(value -> !value.isEmpty())
				.toList();
		configuration.setAllowedOrigins(origins);
		configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"));
		configuration.setAllowedHeaders(List.of("*"));
		configuration.setAllowCredentials(origins.isEmpty() ? false : true);
		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/api/**", configuration);
		source.registerCorsConfiguration("/ws/**", configuration);
		return source;
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
	FilterRegistrationBean<RateLimitFilter> publicRateLimitRegistration(RateLimitFilter filter) {
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
