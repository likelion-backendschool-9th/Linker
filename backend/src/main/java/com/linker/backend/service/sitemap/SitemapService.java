package com.linker.backend.service.sitemap;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.linker.backend.dto.sitemap.SitemapItem;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SitemapService {

	private final Map<SitemapKind, SitemapSource> sources;

	public SitemapService(List<SitemapSource> sources) {
		this.sources = sources.stream().collect(Collectors.toMap(SitemapSource::kind, Function.identity()));
	}

	@Transactional(readOnly = true)
	public SitemapPage list(String kind, int page) {
		if (page < 1 || page > 10_000) {
			throw new ApiException(400, "VALIDATION_ERROR", "페이지 값이 올바르지 않아요");
		}
		SitemapKind parsed = SitemapKind.fromPath(kind);
		SitemapSource source = sources.get(parsed);
		if (source == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "지원하지 않는 sitemap 종류예요");
		}
		return new SitemapPage(parsed.pathValue(), page, source.page(page, PlanLimits.SITEMAP_PAGE_SIZE));
	}

	public record SitemapPage(String kind, int page, List<SitemapItem> items) {
	}
}
