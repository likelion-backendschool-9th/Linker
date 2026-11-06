package com.linker.backend.repository.team;

import com.linker.backend.global.error.ApiException;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.function.Supplier;
import javax.sql.DataSource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** Session lock serializes setup/provider mutations without opening a DB transaction. */
@Component
public class TeamSetupLock {
  private final DataSource source;

  public TeamSetupLock(DataSource source) {
    this.source = source;
  }

  public <T> T team(long id, Supplier<T> operation) {
    return withKey("team:" + id, operation);
  }

  public <T> T organization(long id, Supplier<T> operation) {
    return withKey("org:" + id, operation);
  }

  private <T> T withKey(String scope, Supplier<T> operation) {
    if (TransactionSynchronizationManager.isActualTransactionActive())
      throw new IllegalStateException("Setup must start outside a transaction");
    String key = "linker:team-setup:" + scope;
    try (Connection connection = source.getConnection()) {
      connection.setAutoCommit(true);
      boolean held;
      try (var statement =
          connection.prepareStatement("select pg_try_advisory_lock(hashtextextended(?,0))")) {
        statement.setString(1, key);
        try (var result = statement.executeQuery()) {
          result.next();
          held = result.getBoolean(1);
        }
      }
      if (!held) throw new ApiException(409, "STATE_CONFLICT", "팀 설정을 처리 중이에요. 잠시 후 다시 시도해 주세요");
      try {
        return operation.get();
      } finally {
        try (var statement =
            connection.prepareStatement("select pg_advisory_unlock(hashtextextended(?,0))")) {
          statement.setString(1, key);
          statement.execute();
        } catch (SQLException exception) {
          connection.abort(Runnable::run);
          throw exception;
        }
      }
    } catch (SQLException exception) {
      throw new ApiException(503, "SERVICE_UNAVAILABLE", "팀 설정 연결을 확인해 주세요");
    }
  }
}
