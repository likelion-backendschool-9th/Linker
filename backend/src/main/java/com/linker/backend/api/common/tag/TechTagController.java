package com.linker.backend.api.common.tag;

import java.util.Arrays;
import java.util.List;

import com.linker.backend.domain.account.JobCategory;
import com.linker.backend.domain.account.TechTagRepository;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TechTagController {

	private final TechTagRepository tags;

	public TechTagController(TechTagRepository tags) {
		this.tags = tags;
	}

	@GetMapping("/api/v1/public/tech-tags")
	public ResponseEntity<List<TechTagResponse>> techTags() {
		List<TechTagResponse> body = tags.findAllByOrderBySortOrderAscIdAsc().stream()
				.map(tag -> new TechTagResponse(tag.getId(), tag.getName()))
				.toList();
		return ResponseEntity.ok().cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(1)).cachePublic()).body(body);
	}

	@GetMapping("/api/v1/public/job-categories")
	public ResponseEntity<List<JobCategoryResponse>> jobCategories() {
		List<JobCategoryResponse> body = Arrays.stream(JobCategory.values())
				.map(category -> new JobCategoryResponse(category.name(), category.label()))
				.toList();
		return ResponseEntity.ok().cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(1)).cachePublic()).body(body);
	}
}
