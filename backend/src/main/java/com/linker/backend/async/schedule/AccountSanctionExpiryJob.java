package com.linker.backend.async.schedule;

import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.service.admin.ModerationService;
import java.time.Clock;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Request authentication also reconciles exact expiry; this job covers inactive accounts. */
@Component
public class AccountSanctionExpiryJob {
  private final UserRepository users;
  private final ModerationService moderation;
  private final Clock clock;
  public AccountSanctionExpiryJob(UserRepository users,ModerationService moderation,Clock clock) {
    this.users=users; this.moderation=moderation; this.clock=clock;
  }
  @Scheduled(fixedDelayString="${linker.moderation.expiry-delay-ms:60000}",
      initialDelayString="${linker.moderation.expiry-delay-ms:60000}")
  public void expire() {
    for (long id:users.findExpiredSuspensionIds(clock.instant(),PageRequest.of(0,100))) moderation.expireUserSanction(id);
  }
}
