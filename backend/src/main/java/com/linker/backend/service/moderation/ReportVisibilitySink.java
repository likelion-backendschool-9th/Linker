package com.linker.backend.service.moderation;

import com.linker.backend.entity.moderation.ReportTargetType;

/**
 * Content visibility changes when the post, comment, recruit, and ad tables exist.
 */
public interface ReportVisibilitySink {

	void hideTarget(ReportTargetType type, long targetId);
}
