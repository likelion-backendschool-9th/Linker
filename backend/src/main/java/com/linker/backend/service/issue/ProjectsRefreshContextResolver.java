package com.linker.backend.service.issue;

import java.util.Optional;
import com.linker.backend.dto.issue.ProjectsRefreshContext;
import com.linker.backend.integration.github.ProjectsItemChange;

/** B implements this from verified installation/team/repository/selected-board data. Empty means unlinked. */
@FunctionalInterface
public interface ProjectsRefreshContextResolver {
	Optional<ProjectsRefreshContext> resolve(ProjectsItemChange change);
}
