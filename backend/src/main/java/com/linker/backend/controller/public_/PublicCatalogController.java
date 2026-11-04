package com.linker.backend.controller.public_;

import java.time.Duration;
import java.util.List;

import com.linker.backend.dto.catalog.response.JobCategoryResponse;
import com.linker.backend.dto.catalog.response.TechTagResponse;
import com.linker.backend.service.catalog.CatalogService;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public")
public class PublicCatalogController {

	private final CatalogService catalog;

	public PublicCatalogController(CatalogService catalog) {
		this.catalog = catalog;
	}

	@GetMapping("/tech-tags")
	public ResponseEntity<List<TechTagResponse>> techTags() {
		return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic())
				.body(catalog.techTags());
	}

	@GetMapping("/job-categories")
	public ResponseEntity<List<JobCategoryResponse>> jobCategories() {
		return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic())
				.body(catalog.jobCategories());
	}
}
