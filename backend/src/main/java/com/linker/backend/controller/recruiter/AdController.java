package com.linker.backend.controller.recruiter;

import com.linker.backend.dto.ad.request.RecruiterAdRequest;
import com.linker.backend.dto.ad.request.RecruiterAdStatusRequest;
import com.linker.backend.dto.ad.response.RecruiterAdResponse;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.service.recruiter.AdService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController("recruiterAdController")
@RequestMapping("/recruiter/me/ad")
public class AdController {

	private final AdService ads;

	public AdController(AdService ads) {
		this.ads = ads;
	}

	@GetMapping
	@Tag(name = "p04-profile")
	@Operation(operationId = "getMyJobAd")
	public ResponseEntity<RecruiterAdResponse> current(@AuthenticationPrincipal AuthenticatedUser user) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ads.current(user));
	}

	@PutMapping
	@Tag(name = "p04-profile")
	@Operation(operationId = "saveMyJobAd")
	public ResponseEntity<RecruiterAdResponse> save(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody RecruiterAdRequest request) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ads.save(user, request));
	}

	@PatchMapping("/status")
	@Tag(name = "p04-profile")
	@Operation(operationId = "updateMyJobAdStatus")
	public ResponseEntity<RecruiterAdResponse> status(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody RecruiterAdStatusRequest request) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ads.changeStatus(user, request));
	}
}
