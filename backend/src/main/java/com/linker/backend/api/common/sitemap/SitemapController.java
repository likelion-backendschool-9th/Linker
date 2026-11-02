package com.linker.backend.api.common.sitemap;

import com.linker.backend.domain.sitemap.SitemapService;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SitemapController {

	private final SitemapService sitemaps;

	public SitemapController(SitemapService sitemaps) {
		this.sitemaps = sitemaps;
	}

	@GetMapping("/api/v1/public/sitemap/{kind}")
	public ResponseEntity<SitemapService.SitemapPage> list(
			@PathVariable String kind,
			@RequestParam(name = "page", defaultValue = "1") int page
	) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(1)).cachePublic())
				.body(sitemaps.list(kind, page));
	}
}
