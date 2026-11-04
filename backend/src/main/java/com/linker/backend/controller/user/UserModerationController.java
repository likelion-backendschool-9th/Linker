package com.linker.backend.controller.user;

import java.util.List;

import com.linker.backend.dto.moderation.request.CreateBlockRequest;
import com.linker.backend.dto.moderation.request.CreateReportRequest;
import com.linker.backend.dto.moderation.response.BlockView;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.service.user.UserModerationService;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/user")
@Tag(name = "p00-common")
public class UserModerationController {

	private final UserModerationService moderation;

	public UserModerationController(UserModerationService moderation) {
		this.moderation = moderation;
	}

	@GetMapping("/me/blocks")
	public ResponseEntity<List<BlockView>> list(@AuthenticationPrincipal AuthenticatedUser user) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(moderation.listBlocks(user.userId()));
	}

	@PostMapping("/blocks")
	public ResponseEntity<Void> block(@AuthenticationPrincipal AuthenticatedUser user, @RequestBody CreateBlockRequest request) {
		if (request.userId() == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "차단할 사용자를 확인해 주세요");
		}
		moderation.block(user.userId(), request.userId());
		return ResponseEntity.noContent().build();
	}

	@DeleteMapping("/blocks/{userId}")
	public ResponseEntity<Void> unblock(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable long userId) {
		moderation.unblock(user.userId(), userId);
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/reports")
	public ResponseEntity<Void> report(@AuthenticationPrincipal AuthenticatedUser user, @RequestBody CreateReportRequest request) {
		moderation.report(user.userId(), request.targetType(), request.targetId(), request.reason(), request.detail());
		return ResponseEntity.noContent().build();
	}
}
