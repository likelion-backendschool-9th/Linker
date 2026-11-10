package com.linker.backend.dto.moderation.request;

public record AccountSanctionRequest(String step, String reason, String reasonCode) {}
