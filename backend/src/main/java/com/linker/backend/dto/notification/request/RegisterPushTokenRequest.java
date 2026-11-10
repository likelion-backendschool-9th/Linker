package com.linker.backend.dto.notification.request;

public record RegisterPushTokenRequest(String token, String platform) {
}
