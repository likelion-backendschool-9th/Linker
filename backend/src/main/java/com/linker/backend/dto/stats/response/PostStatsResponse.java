package com.linker.backend.dto.stats.response;

import java.time.LocalDate;
import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

public record PostStatsResponse(List<Item> items) {
  @Schema(name="PostStatsItem")
  public record Item(long postId,String intro,List<Source> bySource,long readmeExpands,List<Day> trend) {}
  @Schema(name="PostStatsSource")
  public record Source(String source,long count) {}
  @Schema(name="PostStatsDay")
  public record Day(LocalDate date,long views) {}
}
