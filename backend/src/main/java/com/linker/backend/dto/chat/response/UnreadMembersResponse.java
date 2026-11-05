package com.linker.backend.dto.chat.response;

import java.util.List;

public record UnreadMembersResponse(List<ChatMemberResponse> items) {
}
