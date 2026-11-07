package com.linker.backend.repository.moderation;

import com.linker.backend.entity.moderation.AdminAction;
import com.linker.backend.entity.moderation.type.AdminActionType;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.*;

class AdminActionRepositoryImpl implements AdminActionRepositoryCustom {
  private final EntityManager em;
  AdminActionRepositoryImpl(EntityManager em) { this.em=em; }
  @Override
  public List<AdminAction> findAuditPage(Long adminId,AdminActionType action,Instant from,Instant until,
      Instant cursorAt,Long cursorId,int limit) {
    StringBuilder query=new StringBuilder("select a from AdminAction a join fetch a.admin op join fetch op.user where 1=1");
    Map<String,Object> parameters=new HashMap<>();
    if (adminId!=null) { query.append(" and op.id=:adminId");parameters.put("adminId",adminId); }
    if (action!=null) { query.append(" and a.action=:action");parameters.put("action",action); }
    if (from!=null) { query.append(" and a.createdAt>=:from");parameters.put("from",from); }
    if (until!=null) { query.append(" and a.createdAt<:until");parameters.put("until",until); }
    if (cursorId!=null) {
      query.append(" and (a.createdAt<:cursorAt or (a.createdAt=:cursorAt and a.id<:cursorId))");
      parameters.put("cursorAt",cursorAt);parameters.put("cursorId",cursorId);
    }
    query.append(" order by a.createdAt desc,a.id desc");
    var q=em.createQuery(query.toString(),AdminAction.class).setMaxResults(limit);
    parameters.forEach(q::setParameter);return q.getResultList();
  }
}
