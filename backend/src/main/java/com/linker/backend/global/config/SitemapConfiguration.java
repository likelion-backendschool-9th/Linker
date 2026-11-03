package com.linker.backend.global.config;

import com.linker.backend.service.sitemap.DeferredSitemapSource;
import com.linker.backend.service.sitemap.SitemapKind;
import com.linker.backend.service.sitemap.SitemapSource;

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
