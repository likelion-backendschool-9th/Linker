package com.linker.backend.integration.storage;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import com.linker.backend.global.error.ApiException;

/**
 * Server-disk storage (user decision 2026-11-10: uploads live on the server's Docker volume).
 * {@link com.linker.backend.service.user.UploadService} rewrites the create response
 * {@code uploadUrl} to {@code PUT /api/v1/user/uploads/{fileId}/content}, which calls {@link #stage}.
 * Files are read back at {@code /files/{key}} by {@link LocalFileServingConfiguration}, a static
 * resource path outside {@code /api/v1}, not a REST endpoint.
 */
public final class LocalObjectStorage implements ObjectStorage {

	/** Same-origin path the proxy and Next forward to the backend's static file handler. */
	public static final String PUBLIC_PATH = "/files/";

	private final Path root;

	public LocalObjectStorage(Path root) {
		this.root = root.toAbsolutePath().normalize();
	}

	public Path root() {
		return root;
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
		return PUBLIC_PATH + key;
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
