package com.linker.backend.domain.sitemap;

import java.time.Instant;

public record SitemapItem(long id, String url, Instant updatedAt) {
}
