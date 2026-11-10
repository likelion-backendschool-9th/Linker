package com.linker.backend.integration.push;

import java.util.Map;

public record PushMessage(String token, String title, String body, String linkPath, Map<String, Object> data) {
}
