package com.linker.backend.dto.chat.response;

import java.time.Instant;

public record ChatLastMessageResponse(String text, Instant createdAt) {
}
