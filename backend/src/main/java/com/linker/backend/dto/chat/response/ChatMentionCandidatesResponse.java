package com.linker.backend.dto.chat.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

public record ChatMentionCandidatesResponse(@Schema(requiredMode = REQUIRED) List<ChatMemberResponse> items) {
}
