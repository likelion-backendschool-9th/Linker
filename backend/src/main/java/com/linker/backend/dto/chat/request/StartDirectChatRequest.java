package com.linker.backend.dto.chat.request;

/**
 * {@code message} is the request's only first message. It is read only when the pair is not a mutual
 * follow or teammates; without it nothing is created and the client asks for it.
 */
public record StartDirectChatRequest(Long userId, String message) {
}
