package com.linker.backend.controller.user;

import com.linker.backend.dto.recruit.response.CursorPage;
import com.linker.backend.dto.recruit.response.MyApplicationResponse;
import com.linker.backend.dto.recruit.response.RecruitCardResponse;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.DeveloperOnly;
import com.linker.backend.service.user.UserRecruitmentService;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/user")
@Tag(name = "p19-recruit-list")
public class UserRecruitmentController {

	private final UserRecruitmentService recruitment;

	public UserRecruitmentController(UserRecruitmentService recruitment) {
		this.recruitment = recruitment;
	}

	@GetMapping("/me/recruits")
	@DeveloperOnly
	public ResponseEntity<CursorPage<RecruitCardResponse>> myRecruits(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestParam(required = false) String cursor
	) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(recruitment.myRecruits(user, cursor));
	}

	@GetMapping("/me/applications")
	@DeveloperOnly
	public ResponseEntity<CursorPage<MyApplicationResponse>> myApplications(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestParam(required = false) String status,
			@RequestParam(required = false) String cursor
	) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(recruitment.myApplications(user, status, cursor));
	}

	@DeleteMapping("/me/applications/{applicationId}")
	@DeveloperOnly
	public ResponseEntity<Void> cancelApplication(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long applicationId
	) {
		recruitment.cancelApplication(user, applicationId);
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}
}
