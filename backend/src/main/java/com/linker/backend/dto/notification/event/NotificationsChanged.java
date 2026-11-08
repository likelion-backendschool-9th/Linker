package com.linker.backend.dto.notification.event;

/**
 * The recipient's visible notifications changed: a row became visible, or one was read. Published
 * inside the writing transaction; the realtime notifier sends it only after commit.
 */
public record NotificationsChanged(long userId) {
}
