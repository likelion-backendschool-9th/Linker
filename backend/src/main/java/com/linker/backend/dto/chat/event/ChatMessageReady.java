package com.linker.backend.dto.chat.event;

import com.linker.backend.dto.chat.response.ChatMessageResponse;

/** Committed text message waiting for the existing room topic. Lost if the process dies before publish. */
public record ChatMessageReady(long roomId, ChatMessageResponse message) {
}
