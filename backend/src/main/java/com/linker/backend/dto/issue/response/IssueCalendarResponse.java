package com.linker.backend.dto.issue.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.List;

/** Inclusive local-date range. Original start/due dates are preserved for period bars. */
@Schema(requiredProperties = {"from", "to", "items"})
public record IssueCalendarResponse(
    LocalDate from, LocalDate to, List<IssueListResponse.Item> items) {}
