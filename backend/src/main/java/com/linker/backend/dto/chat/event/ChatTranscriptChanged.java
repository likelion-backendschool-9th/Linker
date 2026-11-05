package com.linker.backend.dto.chat.event;

import com.linker.backend.dto.chat.response.ChatMessageResponse;

public record ChatTranscriptChanged(String event, long roomId, ChatMessageResponse message) {
}
