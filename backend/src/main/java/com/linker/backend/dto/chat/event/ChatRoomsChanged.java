package com.linker.backend.dto.chat.event;

/**
 * Invalidation for the caller's own chat list. Published only after the first state change commits.
 */
public record ChatRoomsChanged(long userId, long roomId) {
}
