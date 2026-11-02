package com.linker.backend.api.common.upload;

import com.linker.backend.domain.file.UploadService;
import com.linker.backend.global.security.AuthenticatedUser;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class UploadController {

	private final UploadService uploads;

	public UploadController(UploadService uploads) {
		this.uploads = uploads;
	}

	@PostMapping("/api/v1/user/uploads")
	public ResponseEntity<CreateUploadResponse> create(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody CreateUploadRequest request
	) {
		UploadService.CreatedUpload created = uploads.create(
				user,
				request.type(),
				request.purpose(),
				request.contentType(),
				request.size()
		);
		return ResponseEntity.status(201)
				.cacheControl(CacheControl.noStore())
				.body(new CreateUploadResponse(created.fileId(), created.uploadUrl()));
	}

	@PostMapping("/api/v1/user/uploads/{fileId}/complete")
	public ResponseEntity<CompleteUploadResponse> complete(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable String fileId
	) {
		long id = parseId(fileId);
		UploadService.CompletedUpload completed = uploads.complete(user, id);
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(new CompleteUploadResponse(completed.fileId(), completed.url()));
	}

	private long parseId(String fileId) {
		if (fileId == null || !fileId.matches("[0-9]+")) {
			throw new com.linker.backend.global.error.ApiException(404, "NOT_FOUND", "대상을 찾을 수 없어요");
		}
		return Long.parseLong(fileId);
	}
}
