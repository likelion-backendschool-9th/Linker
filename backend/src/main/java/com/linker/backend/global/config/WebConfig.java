package com.linker.backend.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.HandlerTypePredicate;
import org.springframework.web.servlet.config.annotation.PathMatchConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Adds the API version prefix in one place. Controllers under {@code controller} must not repeat it.
 * The GitHub webhook controller lives in {@code integration.github}, so it keeps its own mapping.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

	@Override
	public void configurePathMatch(PathMatchConfigurer configurer) {
		configurer.addPathPrefix(
				"/api/v1",
				HandlerTypePredicate.forBasePackage("com.linker.backend.controller")
		);
	}
}
