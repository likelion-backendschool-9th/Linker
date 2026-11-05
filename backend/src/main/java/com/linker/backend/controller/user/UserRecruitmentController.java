package com.linker.backend.controller.user;

import com.linker.backend.dto.recruit.request.RecruitWriteRequest;
import com.linker.backend.dto.recruit.response.CursorPage;
import com.linker.backend.dto.recruit.response.MyApplicationResponse;
import com.linker.backend.dto.recruit.response.RecruitCardResponse;
import com.linker.backend.dto.recruit.response.RecruitEditFormResponse;
import com.linker.backend.dto.recruit.response.RecruitEditorOptionsResponse;
import com.linker.backend.dto.recruit.response.RecruitIdResponse;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.DeveloperOnly;
import com.linker.backend.global.security.RateLimit;
import com.linker.backend.service.user.UserRecruitmentService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/user")
@Tag(name = "p19-recruit-list")
@Tag(name = "p20-recruit-editor")
public class UserRecruitmentController {

	private final UserRecruitmentService recruitment;

	public UserRecruitmentController(UserRecruitmentService recruitment) {
		this.recruitment = recruitment;
	}

	@GetMapping("/me/recruits")
	@DeveloperOnly
	@Operation(tags = {"p19-recruit-list"})
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
	@Operation(tags = {"p19-recruit-list"})
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
	@Operation(tags = {"p19-recruit-list"})
	public ResponseEntity<Void> cancelApplication(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long applicationId
	) {
		recruitment.cancelApplication(user, applicationId);
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}

	@GetMapping("/recruit-editor/options")
	@DeveloperOnly
	@Operation(tags = {"p20-recruit-editor"})
	public ResponseEntity<RecruitEditorOptionsResponse> editorOptions(
			@AuthenticationPrincipal AuthenticatedUser user
	) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(recruitment.editorOptions(user));
	}

	@PostMapping("/recruits")
	@DeveloperOnly
	@RateLimit(
			key = "recruit.create",
			permits = PlanLimits.RECRUIT_POSTS_PER_DAY,
			windowSeconds = PlanLimits.RECRUIT_POSTS_PER_DAY_WINDOW_SECONDS
	)
	@Operation(tags = {"p20-recruit-editor"})
	public ResponseEntity<RecruitIdResponse> create(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody RecruitWriteRequest request
	) {
		return ResponseEntity.status(HttpStatus.CREATED)
				.cacheControl(CacheControl.noStore())
				.body(recruitment.create(user, request));
	}

	@GetMapping("/recruits/{recruitId}/edit-form")
	@DeveloperOnly
	@Operation(tags = {"p20-recruit-editor"})
	public ResponseEntity<RecruitEditFormResponse> editForm(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long recruitId
	) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(recruitment.editForm(user, recruitId));
	}

	@PutMapping("/recruits/{recruitId}")
	@DeveloperOnly
	@Operation(tags = {"p20-recruit-editor"})
	public ResponseEntity<RecruitIdResponse> update(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long recruitId,
			@RequestBody RecruitWriteRequest request
	) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(recruitment.update(user, recruitId, request));
	}

	@PostMapping("/recruits/{recruitId}/close")
	@DeveloperOnly
	@Operation(tags = {"p20-recruit-editor"})
	public ResponseEntity<Void> close(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long recruitId
	) {
		recruitment.close(user, recruitId);
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}

	@PostMapping("/recruits/{recruitId}/reopen")
	@DeveloperOnly
	@Operation(tags = {"p20-recruit-editor"})
	public ResponseEntity<Void> reopen(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long recruitId
	) {
		recruitment.reopen(user, recruitId);
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}

	@DeleteMapping("/recruits/{recruitId}")
	@DeveloperOnly
	@Operation(tags = {"p20-recruit-editor"})
	public ResponseEntity<Void> delete(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long recruitId
	) {
		recruitment.delete(user, recruitId);
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}
}
