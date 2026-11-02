package com.linker.backend.domain.moderation;

import java.util.Optional;

public interface ReportTargetResolver {

	ReportTargetType supports();

	Optional<ResolvedTarget> resolve(long targetId);

	record ResolvedTarget(long targetUserId) {
	}
}
