package com.linker.backend.dto.moderation.response;

import java.time.Instant;
import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

public record AuditLogsResponse(List<Item> items,String nextCursor) {
  @Schema(name="AdminAuditLogItem")
  public record Item(long id,long adminId,String admin,String actionType,String targetType,Long targetId,
      String target,String reason,Instant createdAt,String sanctionStep) {}
  @Schema(name="AdminAuditOperator")
  public record Operator(long id,String name) {}
  @Schema(name="AdminAuditFilters")
  public record Filters(List<Operator> admins,List<String> actionTypes) {}
}
