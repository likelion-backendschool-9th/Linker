package com.linker.backend.dto.moderation.response;

import java.time.Instant;
import java.util.List;

public record AuditLogsResponse(List<Item> items,String nextCursor) {
  public record Item(long id,long adminId,String admin,String actionType,String targetType,Long targetId,
      String target,String reason,Instant createdAt,String sanctionStep) {}
  public record Operator(long id,String name) {}
  public record Filters(List<Operator> admins,List<String> actionTypes) {}
}
