package com.linker.backend.domain.file;

import java.util.Set;
import java.util.UUID;

import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.storage.ObjectStorage;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UploadService {

	private static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png", "image/webp", "image/gif");

	private final UploadedFileRepository files;
	private final ObjectStorage storage;
	private final ImageInspector images;

	public UploadService(UploadedFileRepository files, ObjectStorage storage, ImageInspector images) {
		this.files = files;
		this.storage = storage;
		this.images = images;
	}

	@Transactional
	public CreatedUpload create(AuthenticatedUser user, String type, String purpose, String contentType, Long size) {
		if (contentType == null || !ALLOWED_TYPES.contains(contentType)) {
			throw new ApiException(400, "VALIDATION_ERROR", "JPG, PNG, WebP, GIF 사진만 올릴 수 있어요.");
		}
		if (size == null || size < 1 || size > PlanLimits.IMAGE_MAX_BYTES) {
			throw new ApiException(400, "VALIDATION_ERROR", "사진은 한 장에 10MB까지 올릴 수 있어요.");
		}
		UploadPurpose resolved = purpose(type, purpose);
		String key = "uploads/" + user.userId() + "/" + UUID.randomUUID();
		UploadedFile file = files.save(UploadedFile.pending(user.userId(), resolved, key, contentType, size));
		ObjectStorage.Presign presign = storage.presignPut(key, contentType, size);
		return new CreatedUpload(Long.toString(file.getId()), presign.url());
	}

	@Transactional
	public CompletedUpload complete(AuthenticatedUser user, long fileId) {
		UploadedFile file = owned(user.userId(), fileId);
		if (file.isComplete()) {
			return new CompletedUpload(Long.toString(file.getId()), file.getUrl());
		}
		ObjectStorage.Head head = storage.head(file.getStorageKey())
				.orElseThrow(() -> new ApiException(409, "STATE_CONFLICT", "파일 업로드가 끝나지 않았어요"));
		if (head.size() != file.getByteSize()) {
			throw new ApiException(400, "VALIDATION_ERROR", "올린 파일 크기가 요청과 달라요");
		}
		byte[] raw = storage.read(file.getStorageKey());
		if (raw.length != file.getByteSize()) {
			throw new ApiException(400, "VALIDATION_ERROR", "올린 파일 크기가 요청과 달라요");
		}
		ImageInspector.ProcessedImage processed = images.inspect(raw, file.getContentType());
		storage.overwrite(file.getStorageKey(), processed.bytes(), processed.contentType());
		String url = storage.publicUrl(file.getStorageKey());
		file.complete(url, processed.contentType(), processed.bytes().length, processed.width(), processed.height());
		return new CompletedUpload(Long.toString(file.getId()), url);
	}

	@Transactional(readOnly = true)
	public UploadedFile requireReady(long fileId, long userId) {
		UploadedFile file = owned(userId, fileId);
		if (!file.isComplete()) {
			throw new ApiException(409, "STATE_CONFLICT", "파일 업로드가 끝나지 않았어요");
		}
		return file;
	}

	private UploadedFile owned(long userId, long fileId) {
		UploadedFile file = files.findById(fileId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "대상을 찾을 수 없어요"));
		if (!file.getUploaderId().equals(userId)) {
			throw new ApiException(404, "NOT_FOUND", "대상을 찾을 수 없어요");
		}
		return file;
	}

	private UploadPurpose purpose(String type, String purpose) {
		UploadPurpose fromPurpose = parse(purpose);
		if (fromPurpose != null) {
			return fromPurpose;
		}
		UploadPurpose fromType = parse(type);
		if (fromType != null) {
			return fromType;
		}
		if (type == null || "IMAGE".equals(type)) {
			return null;
		}
		throw new ApiException(400, "VALIDATION_ERROR", "파일 용도를 확인해 주세요");
	}

	private UploadPurpose parse(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		try {
			return UploadPurpose.valueOf(value);
		}
		catch (IllegalArgumentException exception) {
			return null;
		}
	}

	public record CreatedUpload(String fileId, String uploadUrl) {
	}

	public record CompletedUpload(String fileId, String url) {
	}
}
