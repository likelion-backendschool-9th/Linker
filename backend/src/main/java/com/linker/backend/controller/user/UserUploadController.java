package com.linker.backend.controller.user;

import com.linker.backend.dto.file.request.CreateUploadRequest;
import com.linker.backend.dto.file.response.CompleteUploadResponse;
import com.linker.backend.dto.file.response.CreateUploadResponse;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.service.user.UserUploadService;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/user")
@Tag(name = "p00-common")
public class UserUploadController {

	private final UserUploadService uploads;

	public UserUploadController(UserUploadService uploads) {
		this.uploads = uploads;
	}

	@PostMapping("/uploads")
	public ResponseEntity<CreateUploadResponse> create(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody CreateUploadRequest request
	) {
		UserUploadService.CreatedUpload created = uploads.create(
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

	/**
	 * Local-storage stand-in for the cloud PUT target returned as {@code uploadUrl}.
	 * Not used when a real object-storage provider issues a remote presigned URL.
	 */
	@PutMapping(value = "/uploads/{fileId}/content", consumes = MediaType.ALL_VALUE)
	public ResponseEntity<Void> putContent(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable String fileId,
			@RequestHeader(value = "Content-Type", required = false) String contentType,
			@RequestBody byte[] body
	) {
		uploads.putContent(user, parseId(fileId), contentType, body == null ? new byte[0] : body);
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}

	@PostMapping("/uploads/{fileId}/complete")
	public ResponseEntity<CompleteUploadResponse> complete(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable String fileId
	) {
		long id = parseId(fileId);
		UserUploadService.CompletedUpload completed = uploads.complete(user, id);
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(new CompleteUploadResponse(completed.fileId(), completed.url()));
	}

	private long parseId(String fileId) {
		if (fileId == null || !fileId.matches("[0-9]+")) {
			throw new ApiException(404, "NOT_FOUND", "대상을 찾을 수 없어요");
		}
		return Long.parseLong(fileId);
	}
}
