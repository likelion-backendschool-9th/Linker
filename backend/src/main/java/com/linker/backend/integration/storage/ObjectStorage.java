package com.linker.backend.integration.storage;

import java.util.Optional;

public interface ObjectStorage {

	Presign presignPut(String key, String contentType, long contentLength);

	Optional<Head> head(String key);

	byte[] read(String key);

	void overwrite(String key, byte[] body, String contentType);

	String publicUrl(String key);

	record Presign(String url) {
	}

	record Head(long size) {
	}
}
