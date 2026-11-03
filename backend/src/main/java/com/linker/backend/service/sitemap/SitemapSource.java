package com.linker.backend.service.sitemap;

import java.util.List;

import com.linker.backend.dto.sitemap.SitemapItem;

public interface SitemapSource {

	SitemapKind kind();

	List<SitemapItem> page(int page, int size);
}
