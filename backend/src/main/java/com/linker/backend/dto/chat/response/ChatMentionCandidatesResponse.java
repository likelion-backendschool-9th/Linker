package com.linker.backend.dto.chat.response;

import java.util.List;

public record ChatMentionCandidatesResponse(List<ChatMemberResponse> items) {
}
