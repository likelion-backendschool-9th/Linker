package com.linker.backend.dto.chat.event;

/**
 * A report hide, delete or restore changed a chat message. After commit it is sent on the room topic
 * as {@code EDIT}; {@code ChatDeliveryGuard} rebuilds the message for each subscriber.
 */
public record ChatMessageModerated(long roomId, long messageId) {
}
