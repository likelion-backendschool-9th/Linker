package com.linker.backend.integration.github;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

import com.linker.backend.entity.account.GithubToken;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.repository.account.GithubTokenRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Reads the encrypted user token saved by social login and refreshes it outside a DB transaction. */
@Service
public class PersistedGithubUserAccessTokenSource implements GithubUserAccessTokenSource {

	private static final Duration REFRESH_LEEWAY = Duration.ofSeconds(60);

	private final GithubTokenRepository tokens;
	private final GithubTokenCipher cipher;
	private final GithubUserAuthClient github;
	private final Clock clock;
	private final TransactionTemplate read;
	private final TransactionTemplate write;

	public PersistedGithubUserAccessTokenSource(GithubTokenRepository tokens, GithubTokenCipher cipher,
			GithubUserAuthClient github, Clock clock, PlatformTransactionManager transactions) {
		this.tokens = tokens;
		this.cipher = cipher;
		this.github = github;
		this.clock = clock;
		this.read = new TransactionTemplate(transactions);
		this.read.setReadOnly(true);
		this.write = new TransactionTemplate(transactions);
	}

	@Override
	public String tokenFor(long userId) {
		Stored stored = read.execute(status -> tokens.findByUser_Id(userId).map(this::stored).orElse(null));
		if (stored == null) {
			throw loginAgain();
		}
		Instant now = clock.instant();
		if (stored.accessExpiresAt() != null && stored.accessExpiresAt().isAfter(now.plus(REFRESH_LEEWAY))) {
			return stored.accessToken();
		}
		if (stored.refreshToken() == null || stored.refreshExpiresAt() == null
				|| !stored.refreshExpiresAt().isAfter(now)) {
			throw loginAgain();
		}
		GithubUserSession refreshed = github.refresh(stored.refreshToken());
		write.executeWithoutResult(status -> tokens.findByUser_Id(userId).ifPresent(row -> row.replace(
				cipher.encrypt(refreshed.accessToken()),
				refreshed.accessExpiresAt(),
				cipher.encrypt(refreshed.refreshToken() == null ? stored.refreshToken() : refreshed.refreshToken()),
				refreshed.refreshExpiresAt())));
		return refreshed.accessToken();
	}

	private Stored stored(GithubToken row) {
		return new Stored(
				cipher.decrypt(row.getAccessTokenEnc()),
				row.getAccessExpiresAt(),
				row.getRefreshTokenEnc() == null ? null : cipher.decrypt(row.getRefreshTokenEnc()),
				row.getRefreshExpiresAt());
	}

	private static ApiException loginAgain() {
		return new ApiException(401, "LOGIN_REQUIRED", "GitHub에 다시 로그인해 주세요");
	}

	private record Stored(String accessToken, Instant accessExpiresAt, String refreshToken, Instant refreshExpiresAt) {
	}
}
