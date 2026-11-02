package com.linker.backend.api.common.block;

import java.util.List;

import com.linker.backend.domain.moderation.BlockService;
import com.linker.backend.domain.moderation.BlockView;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class BlockController {

	private final BlockService blocks;

	public BlockController(BlockService blocks) {
		this.blocks = blocks;
	}

	@GetMapping("/api/v1/user/me/blocks")
	public ResponseEntity<List<BlockView>> list(@AuthenticationPrincipal AuthenticatedUser user) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(blocks.listActive(user.userId()));
	}

	@PostMapping("/api/v1/user/blocks")
	public ResponseEntity<Void> block(@AuthenticationPrincipal AuthenticatedUser user, @RequestBody CreateBlockRequest request) {
		if (request.userId() == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "차단할 사용자를 확인해 주세요");
		}
		blocks.block(user.userId(), request.userId());
		return ResponseEntity.noContent().build();
	}

	@DeleteMapping("/api/v1/user/blocks/{userId}")
	public ResponseEntity<Void> unblock(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable long userId) {
		blocks.unblock(user.userId(), userId);
		return ResponseEntity.noContent().build();
	}
}
