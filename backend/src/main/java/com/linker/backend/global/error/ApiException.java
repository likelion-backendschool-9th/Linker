package com.linker.backend.global.error;

import java.util.Map;

public class ApiException extends RuntimeException {

	private final int status;
	private final String code;
	private final Map<String, Object> detail;

	public ApiException(int status, String code, String message) {
		this(status, code, message, null);
	}

	public ApiException(int status, String code, String message, Map<String, Object> detail) {
		super(message);
		this.status = status;
		this.code = code;
		this.detail = detail;
	}

	public int getStatus() {
		return status;
	}

	public String getCode() {
		return code;
	}

	public Map<String, Object> getDetail() {
		return detail;
	}
}
