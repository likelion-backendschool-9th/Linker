package com.linker.backend.domain.moderation;

/**
 * Content visibility changes when the post, comment, recruit, and ad tables exist.
 */
public interface ReportVisibilitySink {

	void hideTarget(ReportTargetType type, long targetId);
}
