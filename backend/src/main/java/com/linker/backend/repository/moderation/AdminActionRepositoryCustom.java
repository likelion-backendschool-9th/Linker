package com.linker.backend.repository.moderation;

import com.linker.backend.entity.moderation.AdminAction;
import com.linker.backend.entity.moderation.type.AdminActionType;
import java.time.Instant;
import java.util.List;

public interface AdminActionRepositoryCustom {
  List<AdminAction> findAuditPage(Long adminId,AdminActionType action,Instant from,Instant until,
      Instant cursorAt,Long cursorId,int limit);
}
