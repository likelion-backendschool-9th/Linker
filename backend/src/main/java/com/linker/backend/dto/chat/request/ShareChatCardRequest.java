package com.linker.backend.dto.chat.request;

public record ShareChatCardRequest(String targetType, Long targetId, String clientMessageId) {
}
