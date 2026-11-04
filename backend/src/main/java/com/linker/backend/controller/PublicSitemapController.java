package com.linker.backend.controller;

import com.linker.backend.service.PublicSitemapService;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public")
public class PublicSitemapController {

	private final PublicSitemapService sitemaps;

	public PublicSitemapController(PublicSitemapService sitemaps) {
		this.sitemaps = sitemaps;
	}

	@GetMapping("/sitemap/{kind}")
	public ResponseEntity<PublicSitemapService.SitemapPage> list(
			@PathVariable String kind,
			@RequestParam(name = "page", defaultValue = "1") int page
	) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(1)).cachePublic())
				.body(sitemaps.list(kind, page));
	}
}
