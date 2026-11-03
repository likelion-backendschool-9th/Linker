package com.linker.backend.service.moderation;

import org.springframework.stereotype.Component;

@Component
public class NoOpChatReportSnapshotter implements ChatReportSnapshotter {

	@Override
	public void capture(long reportId, long messageId) {
	}
}
