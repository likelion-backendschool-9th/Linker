package com.linker.backend.dto.chat.event;

/**
 * Sender-only confirmation that this client id is already stored.
 * It is not a topic rebroadcast and not a broker receipt.
 */
public record ChatSendAccepted(long userId, long roomId, String clientMessageId, long messageId) {
}
