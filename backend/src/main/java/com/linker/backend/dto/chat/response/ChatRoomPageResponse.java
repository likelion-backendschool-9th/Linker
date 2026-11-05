package com.linker.backend.dto.chat.response;

import java.util.List;

public record ChatRoomPageResponse(List<ChatRoomItemResponse> items, String nextCursor) {
}
