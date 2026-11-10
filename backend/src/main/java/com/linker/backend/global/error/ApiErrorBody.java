package com.linker.backend.global.error;

import java.util.Map;

public record ApiErrorBody(String code, String message, Map<String, Object> detail) {
}
