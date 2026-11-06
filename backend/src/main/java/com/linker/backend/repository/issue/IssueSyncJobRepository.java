package com.linker.backend.repository.issue;

import com.linker.backend.entity.issue.IssueSyncJob;
import org.springframework.data.jpa.repository.JpaRepository;

/** Page 12 edit retries and page 13 creation intents share issue_sync_jobs. */
public interface IssueSyncJobRepository
    extends JpaRepository<IssueSyncJob, Long>, IssueSyncJobRepositoryCustom {}
