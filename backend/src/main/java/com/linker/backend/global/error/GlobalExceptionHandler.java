package com.linker.backend.global.error;

import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
	private static final String GENERIC = "잠시 후 다시 시도해 주세요";

	@ExceptionHandler(ApiException.class)
	public ResponseEntity<ApiErrorBody> api(ApiException exception) {
		if (exception.getStatus() >= 500) {
			log.warn("api error {} {}", exception.getStatus(), exception.getCode());
		}
		return ResponseEntity.status(exception.getStatus())
				.body(new ApiErrorBody(exception.getCode(), exception.getMessage(), exception.getDetail()));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ApiErrorBody> invalid(MethodArgumentNotValidException exception) {
		Map<String, Object> fields = new LinkedHashMap<>();
		exception.getBindingResult().getFieldErrors()
				.forEach(error -> fields.put(error.getField(), "값을 확인해 주세요"));
		return ResponseEntity.badRequest()
				.body(new ApiErrorBody("VALIDATION_ERROR", "요청 값을 확인해 주세요", Map.of("fields", fields)));
	}

	@ExceptionHandler(HttpMessageNotReadableException.class)
	public ResponseEntity<ApiErrorBody> unreadable(HttpMessageNotReadableException exception) {
		return ResponseEntity.badRequest()
				.body(new ApiErrorBody("VALIDATION_ERROR", "요청 값을 확인해 주세요", null));
	}

	@ExceptionHandler({NoHandlerFoundException.class, NoResourceFoundException.class})
	public ResponseEntity<ApiErrorBody> missing() {
		return ResponseEntity.status(404)
				.body(new ApiErrorBody("NOT_FOUND", "대상을 찾을 수 없어요", null));
	}

	@ExceptionHandler(HttpRequestMethodNotSupportedException.class)
	public ResponseEntity<ApiErrorBody> method() {
		return ResponseEntity.status(405)
				.body(new ApiErrorBody("METHOD_NOT_ALLOWED", "지원하지 않는 요청이에요", null));
	}

	@ExceptionHandler(DataIntegrityViolationException.class)
	public ResponseEntity<ApiErrorBody> conflict(DataIntegrityViolationException exception) {
		log.warn("data conflict {}", exception.getClass().getSimpleName());
		return ResponseEntity.status(409)
				.body(new ApiErrorBody("STATE_CONFLICT", "요청이 충돌했어요", null));
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ApiErrorBody> unexpected(Exception exception) {
		log.error("request failed: {}", exception.getClass().getSimpleName());
		return ResponseEntity.status(500).body(new ApiErrorBody("INTERNAL_ERROR", GENERIC, null));
	}
}
