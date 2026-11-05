package com.linker.backend.integration.github;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import javax.sql.DataSource;

import org.springframework.stereotype.Component;

/**
 * Cross-worker lock without an open DB transaction or an expiring Redis lease.
 * Negative bigint advisory keys are reserved for delivery IDs. One connection is
 * held per active dispatcher; business DB work uses short, separate transactions.
 */
@Component
public class GithubWebhookDispatchLock {
	private final DataSource dataSource;

	public GithubWebhookDispatchLock(DataSource dataSource) {
		this.dataSource = dataSource;
	}

	public void withLock(long deliveryId, Runnable work) {
		if (deliveryId <= 0) {
			return;
		}
		try (Connection connection = dataSource.getConnection()) {
			if (!connection.getAutoCommit()) {
				throw new IllegalStateException("Webhook dispatch lock requires autocommit");
			}
			if (!query(connection, "select pg_try_advisory_lock(?)", -deliveryId)) {
				return;
			}
			try {
				work.run();
			}
			finally {
				try {
					if (!query(connection, "select pg_advisory_unlock(?)", -deliveryId)) {
						throw new SQLException("Webhook lock was not released");
					}
				}
				catch (SQLException exception) {
					// Never return a session carrying an advisory lock to the pool.
					connection.abort(Runnable::run);
					throw exception;
				}
			}
		}
		catch (SQLException exception) {
			throw new IllegalStateException("Webhook dispatch lock unavailable");
		}
	}

	private boolean query(Connection connection, String sql, long key) throws SQLException {
		try (PreparedStatement statement = connection.prepareStatement(sql)) {
			statement.setLong(1, key);
			try (var result = statement.executeQuery()) {
				return result.next() && result.getBoolean(1);
			}
		}
	}
}
