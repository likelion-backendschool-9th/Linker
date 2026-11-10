package com.linker.backend.dto.chat.response;

/** {@code avatarUrl}: the team photo for TEAM rooms, the other person's photo for DIRECT (null when none). */
public record ChatShareTargetResponse(long roomId, String kind, String title, String avatarUrl) {
}
