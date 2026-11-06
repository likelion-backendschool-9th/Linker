package com.linker.backend.repository.issue;

import com.linker.backend.dto.issue.response.IssuePersistenceView.CreationJob;
import com.linker.backend.dto.issue.response.IssuePersistenceView.EditJob;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface IssueSyncJobRepositoryCustom {

  // Page 12 edits (step <> CREATE). Durable desired values only, never tokens or provider bodies.

  long queueEdit(long issue, long actor, String step, String payload, Instant now);

  EditJob edit(long id);

  List<Long> dueEdits(Instant now);

  void startEdit(long id, Instant leaseEnd);

  void finishEdit(long id, long issue);

  void failEdit(long id, long issue, boolean terminal, String error, Instant retryAt);

  // Page 13 creation intents (step = CREATE), stored before GitHub returns an issue.

  CreationJob creation(long id);

  CreationJob existingCreation(long actor, UUID key);

  /** Called in a short transaction. Serializes the per-author daily quota across instances. */
  long queueCreation(long team, long actor, UUID key, String payload, Instant now);

  List<Long> dueCreations(Instant now);

  void startCreation(long id, Instant lease);

  void checkpointCreation(long id, String payload, Long issue);

  void finishCreation(long id, long issue);

  void failCreation(long id, boolean terminal, String error, Instant next);
}
