package com.linker.backend.integration.storage;

import java.time.Duration;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Serves completed uploads from the local storage root at {@code GET /files/{key}}. Keys are random
 * UUIDs with the stored image's extension, so the content type follows the file name and a file is
 * never rewritten after its URL is handed out (hence the long immutable cache). Security permits the
 * path for everyone, like a public bucket URL.
 */
@Configuration
@ConditionalOnProperty(name = "linker.storage.mode", havingValue = "local")
public class LocalFileServingConfiguration implements WebMvcConfigurer {

	private final LocalObjectStorage storage;

	public LocalFileServingConfiguration(LocalObjectStorage storage) {
		this.storage = storage;
	}

	@Override
	public void addResourceHandlers(ResourceHandlerRegistry registry) {
		String location = storage.root().toUri().toString();
		registry.addResourceHandler(LocalObjectStorage.PUBLIC_PATH + "**")
				.addResourceLocations(location.endsWith("/") ? location : location + "/")
				.setCacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable());
	}
}
