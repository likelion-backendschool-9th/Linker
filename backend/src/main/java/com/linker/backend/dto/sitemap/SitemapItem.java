package com.linker.backend.dto.sitemap;

import java.time.Instant;

public record SitemapItem(long id, String url, Instant updatedAt) {
}
