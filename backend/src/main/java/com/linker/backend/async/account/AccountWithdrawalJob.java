package com.linker.backend.async.account;

import java.time.Clock;
import java.time.Instant;

import com.linker.backend.service.user.UserAccountService;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Anonymizes accounts whose 30-day pending withdrawal has elapsed. */
@Component
public class AccountWithdrawalJob {

	private final UserAccountService accounts;
	private final Clock clock;

	public AccountWithdrawalJob(UserAccountService accounts, Clock clock) {
		this.accounts = accounts;
		this.clock = clock;
	}

	@Scheduled(cron = "0 0 0 * * *", zone = "Asia/Seoul")
	public void anonymizeExpired() {
		accounts.anonymizeExpiredWithdrawals(Instant.now(clock));
	}
}
