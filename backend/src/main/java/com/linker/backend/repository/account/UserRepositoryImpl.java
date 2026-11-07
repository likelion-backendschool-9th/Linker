package com.linker.backend.repository.account;

import com.linker.backend.dto.account.response.AccountSanctionState;
import com.linker.backend.entity.account.User;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

class UserRepositoryImpl implements UserRepositoryCustom {
  private final EntityManager entityManager;
  UserRepositoryImpl(EntityManager entityManager) { this.entityManager = entityManager; }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public AccountSanctionState accountSanctionState(User user, Instant now) {
    entityManager.flush();
    entityManager.refresh(user);
    Object[] row = entityManager.createQuery("""
        select count(s), sum(case when s.endsAt is null then 1 else 0 end), max(s.endsAt)
        from Sanction s where s.user.id=:user and s.revokedAt is null and s.startsAt<=:now
          and s.sanctionType in ('SUSPENSION','PERMANENT_BAN')
          and (s.endsAt is null or s.endsAt>:now)
        """, Object[].class).setParameter("user", user.getId()).setParameter("now", now).getSingleResult();
    boolean banned = entityManager.createQuery("""
        select count(b)>0 from BannedGithubId b, AuthIdentity i
        where i.user.id=:user and i.provider='GITHUB' and i.providerUserId=b.githubUserId
        """, Boolean.class).setParameter("user", user.getId()).getSingleResult();
    var revokedQuery = entityManager.createQuery("""
        select count(s)>0 from Sanction s where s.user.id=:user and s.revokedAt is not null
          and s.sanctionType in ('SUSPENSION','PERMANENT_BAN')
        """ + (user.getSuspendedUntil() == null ? " and s.endsAt is null" : " and s.endsAt=:until"),
        Boolean.class).setParameter("user", user.getId());
    if (user.getSuspendedUntil() != null) revokedQuery.setParameter("until", user.getSuspendedUntil());
    boolean revoked = revokedQuery.getSingleResult();
    boolean permanent = banned || (row[1] != null && ((Number) row[1]).longValue() > 0);
    return new AccountSanctionState(banned || ((Number) row[0]).longValue() > 0,
        permanent ? null : (Instant) row[2], revoked);
  }
}
