package com.linker.backend.dto.chat.response;

/**
 * Team history window actually applied. Flex is not a stored entitlement in this build.
 */
public record ChatHistoryLimitResponse(String applied, boolean flexSupported) {
}
