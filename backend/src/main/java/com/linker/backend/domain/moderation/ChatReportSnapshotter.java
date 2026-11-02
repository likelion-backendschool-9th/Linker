package com.linker.backend.domain.moderation;

/**
 * Copies the reported chat message and ten messages on either side once chat storage exists.
 */
public interface ChatReportSnapshotter {

	void capture(long reportId, long messageId);
}
