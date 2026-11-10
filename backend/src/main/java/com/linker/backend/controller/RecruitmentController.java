package com.linker.backend.controller;

import com.linker.backend.dto.recruit.response.CursorPage;
import com.linker.backend.dto.recruit.response.RecruitCardResponse;
import com.linker.backend.dto.recruit.response.RecruitDetailResponse;
import com.linker.backend.service.RecruitmentService;

import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/public")
public class RecruitmentController {

	private final RecruitmentService recruitment;

	public RecruitmentController(RecruitmentService recruitment) {
		this.recruitment = recruitment;
	}

	@GetMapping("/recruits")
	@Operation(tags = {"p19-recruit-list"})
	public ResponseEntity<CursorPage<RecruitCardResponse>> list(
			@RequestParam(required = false) String q,
			@RequestParam(required = false) String role,
			@RequestParam(required = false) String tech,
			@RequestParam(required = false) String mode,
			@RequestParam(required = false) String sort,
			@RequestParam(required = false) String cursor
	) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(recruitment.listOpen(q, role, tech, mode, sort, cursor));
	}

	@GetMapping("/recruits/{recruitId}")
	@Operation(tags = {"p21-recruit-detail"})
	public ResponseEntity<RecruitDetailResponse> detail(@PathVariable long recruitId) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(recruitment.detail(recruitId));
	}
}
