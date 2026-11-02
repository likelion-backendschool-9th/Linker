package com.linker.backend.domain.sitemap;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SitemapConfiguration {

	@Bean
	SitemapSource postSitemapSource() {
		return new DeferredSitemapSource(SitemapKind.POSTS);
	}

	@Bean
	SitemapSource recruitSitemapSource() {
		return new DeferredSitemapSource(SitemapKind.RECRUITS);
	}
}
