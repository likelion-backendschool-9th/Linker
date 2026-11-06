package com.linker.backend.entity.issue.type;

/** issue_sync_jobs.status. RUNNING keeps a lease in next_retry_at. */
public enum IssueSyncJobStatus {
	PENDING, RUNNING, DONE, FAILED
}
