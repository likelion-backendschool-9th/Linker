package com.linker.backend.repository.account;

import com.linker.backend.dto.account.response.AccountSanctionState;
import com.linker.backend.entity.account.User;
import java.time.Instant;

public interface UserRepositoryCustom {
  /** Caller first locks this user through JPA; refresh prevents a stale first-level snapshot. */
  AccountSanctionState accountSanctionState(User user, Instant now);
}
