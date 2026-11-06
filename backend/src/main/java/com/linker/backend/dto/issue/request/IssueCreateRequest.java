package com.linker.backend.dto.issue.request;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** requestId is generated once per draft and reused on resend. Never contains a credential. */
public record IssueCreateRequest(
    @NotNull java.util.UUID requestId,
    @Positive long repoId,
    @NotBlank String title,
    String body,
    String templateKey,
    Map<String, List<String>> answers,
    List<Long> assigneeIds,
    List<String> labels,
    LocalDate startDate,
    LocalDate dueDate,
    String status) {}
