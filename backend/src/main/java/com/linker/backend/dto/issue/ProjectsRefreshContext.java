package com.linker.backend.dto.issue;

import java.util.Map;
import java.util.Objects;

/** B resolves this from verified installation/team/repository/board storage, never request IDs alone. */
public record ProjectsRefreshContext(long teamId, long repoId, long installationId, long organizationId,
		String repositoryNodeId, String projectId, String statusFieldId, String startFieldId,
		String dueFieldId, Map<String, BoardStatus> statusOptions) {

	public enum BoardStatus { TODO, IN_PROGRESS, BLOCKED, DONE, OTHER, NONE }

	public ProjectsRefreshContext {
		if (teamId <= 0 || repoId <= 0 || installationId <= 0 || organizationId <= 0) throw new IllegalArgumentException("Invalid Projects context IDs");
		for (String id : new String[]{repositoryNodeId, projectId, statusFieldId, startFieldId, dueFieldId}) {
			if (id == null || id.isBlank()) throw new IllegalArgumentException("Projects context requires configured field IDs");
		}
		if (statusFieldId.equals(startFieldId) || statusFieldId.equals(dueFieldId) || startFieldId.equals(dueFieldId)) {
			throw new IllegalArgumentException("Projects field IDs must be distinct");
		}
		statusOptions = Map.copyOf(Objects.requireNonNull(statusOptions));
		statusOptions.forEach((key, value) -> {
			if (key.isBlank() || value == BoardStatus.NONE) throw new IllegalArgumentException("Invalid status option mapping");
		});
	}
}
