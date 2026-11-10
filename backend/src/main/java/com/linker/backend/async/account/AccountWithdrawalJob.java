package com.linker.backend.async.account;

import java.time.Clock;
import java.time.Instant;

import com.linker.backend.service.user.AccountService;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Anonymizes accounts whose 30-day pending withdrawal has elapsed. */
@Component
public class AccountWithdrawalJob {

	private final AccountService accounts;
	private final Clock clock;

	public AccountWithdrawalJob(AccountService accounts, Clock clock) {
		this.accounts = accounts;
		this.clock = clock;
	}

	@Scheduled(cron = "0 0 0 * * *", zone = "Asia/Seoul")
	public void anonymizeExpired() {
		Instant now = Instant.now(clock);
		accounts.anonymizeExpiredWithdrawals(now);
		accounts.settleInactiveProfiles(now);
	}
}
