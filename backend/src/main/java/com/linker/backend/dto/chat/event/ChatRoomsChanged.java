package com.linker.backend.dto.chat.event;

/**
 * Invalidation for one account's chat list and badge. Published only after the state change commits.
 */
public record ChatRoomsChanged(long userId, long roomId) {
}
