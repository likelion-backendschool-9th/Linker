package com.linker.backend.service.issue;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Objects;

import com.linker.backend.dto.issue.IssueCacheSnapshot;
import com.linker.backend.dto.issue.ProjectsRefreshContext;
import com.linker.backend.dto.issue.ProjectsRefreshContext.BoardStatus;
import com.linker.backend.integration.github.GithubIssuesClient;
import com.linker.backend.integration.github.GithubProjectsClient;
import com.linker.backend.repository.issue.IssueCacheRepository;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@ConditionalOnProperty(prefix = "linker.github.projects", name = "consumer-enabled", havingValue = "true")
public class ProjectsCacheRefreshService {

	private final IssueCacheService cache;
	private final IssueCacheRepository issues;
	private final GithubIssuesClient githubIssues;
	private final GithubProjectsClient projects;
	private final Clock clock;

	public ProjectsCacheRefreshService(IssueCacheService cache, IssueCacheRepository issues,
			GithubIssuesClient githubIssues, GithubProjectsClient projects, Clock clock) {
		this.cache = cache; this.issues = issues; this.githubIssues = githubIssues; this.projects = projects; this.clock = clock;
	}

	/**
	 * The caller's delivery transaction must survive cache failure so B can persist FAILED.
	 * Lock the issue before the bounded authoritative Projects reads: delayed/concurrent hints
	 * always re-read current membership instead of overwriting from stale webhook field values.
	 */
	@Transactional(propagation = Propagation.REQUIRES_NEW, timeout = 45)
	public long refresh(ProjectsRefreshContext context, IssueCacheSnapshot source, String token) {
		if (source.teamId() != context.teamId() || source.repoId() != context.repoId()) {
			throw new IllegalArgumentException("Issue context mismatch");
		}
		var result = cache.refresh(source);
		var current = issues.lockProjectReference(result.issueId(), context.teamId(), context.repoId());
		var member = githubIssues.currentProjectItem(token, context, source.githubNodeId());
		String itemId = null;
		BoardStatus status = BoardStatus.NONE;
		LocalDate start = null, due = null;
		if (member.isPresent()) {
			var values = projects.itemValues(token, member.orElseThrow());
			if (!context.projectId().equals(values.projectId()) || !Objects.equals(source.githubNodeId(), values.issueNodeId())) {
				throw new IllegalArgumentException("Project item context mismatch");
			}
			if (!values.archived()) {
				itemId = values.itemId();
				String option = values.selectedOptions().get(context.statusFieldId());
				status = current.state() == IssueCacheSnapshot.State.CLOSED ? BoardStatus.DONE
						: option == null ? BoardStatus.OTHER : context.statusOptions().getOrDefault(option, BoardStatus.OTHER);
				start = values.dates().get(context.startFieldId());
				due = values.dates().get(context.dueFieldId());
				if (start != null && due != null && start.isAfter(due)) throw new IllegalArgumentException("Project start is after due date");
			}
		}
		issues.applyProjectValues(current.id(), itemId, status, start, due, clock.instant());
		return current.id();
	}
}
