package com.linker.backend.controller;

import com.linker.backend.dto.recruit.response.CursorPage;
import com.linker.backend.dto.recruit.response.RecruitCardResponse;
import com.linker.backend.service.PublicRecruitmentService;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public")
@Tag(name = "p19-recruit-list")
public class PublicRecruitmentController {

	private final PublicRecruitmentService recruitment;

	public PublicRecruitmentController(PublicRecruitmentService recruitment) {
		this.recruitment = recruitment;
	}

	@GetMapping("/recruits")
	public ResponseEntity<CursorPage<RecruitCardResponse>> list(
			@RequestParam(required = false) String role,
			@RequestParam(required = false) String tech,
			@RequestParam(required = false) String mode,
			@RequestParam(required = false) String sort,
			@RequestParam(required = false) String cursor
	) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(recruitment.listOpen(role, tech, mode, sort, cursor));
	}
}
