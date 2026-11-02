package com.linker.backend.domain.sitemap;

import java.util.List;

public interface SitemapSource {

	SitemapKind kind();

	List<SitemapItem> page(int page, int size);
}
