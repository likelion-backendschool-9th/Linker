package com.linker.backend.dto.file.request;

/**
 * The web client currently sends {@code type: IMAGE}. ERD purposes are POST, CHAT, ISSUE, and AVATAR.
 * {@code purpose} or a purpose-valued {@code type} is stored. IMAGE leaves purpose empty.
 */
public record CreateUploadRequest(String type, String purpose, String contentType, Long size) {
}
