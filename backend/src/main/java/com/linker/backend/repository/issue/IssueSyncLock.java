package com.linker.backend.repository.issue;

import com.linker.backend.global.error.ApiException;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.function.Supplier;
import javax.sql.DataSource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Session advisory lock covers source READ through cache COMMIT across all instances/entry points.
 */
@Component
public class IssueSyncLock {
  private final DataSource dataSource;

  public IssueSyncLock(DataSource dataSource) {
    this.dataSource = dataSource;
  }

  public <T> T team(long teamId, Supplier<T> action) {
    if (TransactionSynchronizationManager.isActualTransactionActive())
      throw new IllegalStateException("Issue sync must start outside a transaction");
    try (Connection connection = dataSource.getConnection()) {
      connection.setAutoCommit(true);
      String key = "linker:issue-team:" + teamId;
      boolean held;
      try (var statement =
          connection.prepareStatement("SELECT pg_try_advisory_lock(hashtextextended(?,0))")) {
        statement.setString(1, key);
        try (var rs = statement.executeQuery()) {
          rs.next();
          held = rs.getBoolean(1);
        }
      }
      if (!held) throw new ApiException(409, "STATE_CONFLICT", "이슈를 갱신 중이에요. 잠시 후 다시 시도해 주세요");
      try {
        return action.get();
      } finally {
        try (var statement =
            connection.prepareStatement("SELECT pg_advisory_unlock(hashtextextended(?,0))")) {
          statement.setString(1, key);
          statement.execute();
        } catch (SQLException e) {
          connection.abort(Runnable::run);
          throw e;
        }
      }
    } catch (SQLException e) {
      throw new ApiException(503, "SERVICE_UNAVAILABLE", "이슈 갱신 연결을 확인해 주세요");
    }
  }
}
