package com.linker.backend.dto.stats.response;

import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

public record StatsSummaryResponse(List<Item> items,boolean isPro) {
  @Schema(name="StatsSummaryItem")
  public record Item(long postId,String intro,long likeCount,long commentCount,long viewCount) {}
}
