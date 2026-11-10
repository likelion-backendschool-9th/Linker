package com.linker.backend.controller;

import java.time.Duration;
import java.util.List;

import com.linker.backend.dto.catalog.response.JobCategoryResponse;
import com.linker.backend.dto.catalog.response.TechTagResponse;
import com.linker.backend.service.CatalogService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/public")
public class CatalogController {

	private final CatalogService catalog;

	public CatalogController(CatalogService catalog) {
		this.catalog = catalog;
	}

	@GetMapping("/tech-tags")
	@Tag(name = "p00-common")
	@Operation(operationId = "listTechTags")
	public ResponseEntity<List<TechTagResponse>> techTags() {
		return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic())
				.body(catalog.techTags());
	}

	@GetMapping("/job-categories")
	@Tag(name = "p00-common")
	@Operation(operationId = "listJobCategories")
	public ResponseEntity<List<JobCategoryResponse>> jobCategories() {
		return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic())
				.body(catalog.jobCategories());
	}
}
