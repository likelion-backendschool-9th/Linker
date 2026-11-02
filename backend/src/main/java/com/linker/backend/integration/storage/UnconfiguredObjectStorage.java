package com.linker.backend.integration.storage;

import java.util.Optional;

import com.linker.backend.global.error.ApiException;

/**
 * Used when no object-storage provider is configured. The provider and region are unresolved.
 */
public final class UnconfiguredObjectStorage implements ObjectStorage {

	@Override
	public Presign presignPut(String key, String contentType, long contentLength) {
		throw unavailable();
	}

	@Override
	public Optional<Head> head(String key) {
		throw unavailable();
	}

	@Override
	public byte[] read(String key) {
		throw unavailable();
	}

	@Override
	public void overwrite(String key, byte[] body, String contentType) {
		throw unavailable();
	}

	@Override
	public String publicUrl(String key) {
		throw unavailable();
	}

	private ApiException unavailable() {
		return new ApiException(503, "STORAGE_UNAVAILABLE", "파일 저장소가 설정되지 않았어요");
	}
}
