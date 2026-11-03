package com.linker.backend.service.catalog;

import java.util.Arrays;
import java.util.List;

import com.linker.backend.dto.catalog.response.JobCategoryResponse;
import com.linker.backend.dto.catalog.response.TechTagResponse;
import com.linker.backend.entity.profile.JobCategory;
import com.linker.backend.repository.profile.TechTagRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CatalogService {

	private final TechTagRepository tags;

	public CatalogService(TechTagRepository tags) {
		this.tags = tags;
	}

	@Transactional(readOnly = true)
	public List<TechTagResponse> techTags() {
		return tags.findAllByOrderBySortOrderAscIdAsc().stream()
				.map(tag -> new TechTagResponse(tag.getId(), tag.getName()))
				.toList();
	}

	public List<JobCategoryResponse> jobCategories() {
		return Arrays.stream(JobCategory.values())
				.map(category -> new JobCategoryResponse(category.name(), category.label()))
				.toList();
	}
}
