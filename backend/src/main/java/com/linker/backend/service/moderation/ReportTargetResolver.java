package com.linker.backend.service.moderation;

import java.util.Optional;

import com.linker.backend.entity.moderation.ReportTargetType;

public interface ReportTargetResolver {

	ReportTargetType supports();

	Optional<ResolvedTarget> resolve(long targetId);

	record ResolvedTarget(long targetUserId) {
	}
}
