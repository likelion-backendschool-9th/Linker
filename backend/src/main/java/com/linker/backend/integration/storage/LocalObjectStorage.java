package com.linker.backend.integration.storage;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import com.linker.backend.global.error.ApiException;

/**
 * Dev and test stand-in. The presigned URL is not an HTTP endpoint; callers place bytes with {@link #stage}.
 * A real provider still has to be chosen before clients can PUT an upload.
 */
public final class LocalObjectStorage implements ObjectStorage {

	private final Path root;

	public LocalObjectStorage(Path root) {
		this.root = root.toAbsolutePath().normalize();
	}

	public void stage(String key, byte[] body) {
		try {
			Path path = resolve(key);
			Files.createDirectories(path.getParent());
			Files.write(path, body);
		}
		catch (IOException exception) {
			throw new ApiException(503, "STORAGE_UNAVAILABLE", "파일을 저장하지 못했어요");
		}
	}

	@Override
	public Presign presignPut(String key, String contentType, long contentLength) {
		return new Presign("local-upload://" + key);
	}

	@Override
	public Optional<Head> head(String key) {
		Path path = resolve(key);
		if (!Files.exists(path)) {
			return Optional.empty();
		}
		try {
			return Optional.of(new Head(Files.size(path)));
		}
		catch (IOException exception) {
			throw new ApiException(503, "STORAGE_UNAVAILABLE", "파일을 확인하지 못했어요");
		}
	}

	@Override
	public byte[] read(String key) {
		try {
			return Files.readAllBytes(resolve(key));
		}
		catch (IOException exception) {
			throw new ApiException(503, "STORAGE_UNAVAILABLE", "파일을 읽지 못했어요");
		}
	}

	@Override
	public void overwrite(String key, byte[] body, String contentType) {
		stage(key, body);
	}

	@Override
	public String publicUrl(String key) {
		return "local://" + key;
	}

	private Path resolve(String key) {
		if (key == null || key.isBlank() || key.contains("..") || key.startsWith("/") || key.contains("\\")) {
			throw new ApiException(400, "VALIDATION_ERROR", "파일 키가 올바르지 않아요");
		}
		Path resolved = root.resolve(key).normalize();
		if (!resolved.startsWith(root)) {
			throw new ApiException(400, "VALIDATION_ERROR", "파일 키가 올바르지 않아요");
		}
		return resolved;
	}
}
