package com.linker.backend.dto.stats.response;

import java.time.LocalDate;
import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

/** Counts only. Recruiter identities and company information never enter this response. */
public record RecruiterViewsResponse(long thisWeek,List<Week> weeks) {
  @Schema(name="StatsRecruiterWeek")
  public record Week(LocalDate weekStart,long count) {}
}
