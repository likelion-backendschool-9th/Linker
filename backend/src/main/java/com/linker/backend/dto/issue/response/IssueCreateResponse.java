package com.linker.backend.dto.issue.response;

public record IssueCreateResponse(
    long jobId,
    String status,
    String step,
    Long issueId,
    String detailPath,
    String errorCode,
    boolean retryScheduled,
    Long retryAfterSeconds) {}
