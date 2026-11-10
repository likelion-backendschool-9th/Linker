package com.linker.backend.async.moderation;

import com.linker.backend.dto.moderation.request.DailyLimitRejected;
import com.linker.backend.service.admin.UserAdministrationService;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.stereotype.Component;

@Component
public class DailyLimitReviewListener {
  private final UserAdministrationService users;
  public DailyLimitReviewListener(UserAdministrationService users) {this.users=users;}
  @TransactionalEventListener(phase=TransactionPhase.AFTER_COMPLETION,fallbackExecution=true)
  public void record(DailyLimitRejected event) {users.recordDailyLimitRejection(event);}
}
