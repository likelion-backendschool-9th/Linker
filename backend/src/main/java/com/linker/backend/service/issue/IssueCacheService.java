package com.linker.backend.service.issue;

import java.time.Clock;
import java.time.Instant;
import java.util.Optional;

import com.linker.backend.dto.issue.CachedIssue;
import com.linker.backend.dto.issue.IssueCacheSnapshot;
import com.linker.backend.repository.issue.IssueCacheRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** Trusted sync boundary only. No public route/handler is registered before B's context is available. */
@Service
public class IssueCacheService {

	private final IssueCacheRepository issues;
	private final Clock clock;

	public IssueCacheService(IssueCacheRepository issues, Clock clock) { this.issues = issues; this.clock = clock; }

	@Transactional
	public IssueCacheRepository.WriteResult refresh(IssueCacheSnapshot snapshot) {
		Instant now = Instant.now(clock);
		var result = issues.upsert(snapshot, now);
		if (result.updated()) issues.replaceRelations(result.issueId(), snapshot, now);
		return result;
	}

	/** Repeatable read keeps parent and child rows from different refreshes out of the same result. */
	@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
	public Optional<CachedIssue> findForTeam(long issueId, long teamId) {
		return issues.findForTeam(issueId, teamId);
	}
}
