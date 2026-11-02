package com.linker.backend.domain.moderation;

import org.springframework.stereotype.Component;

@Component
public class NoOpReportVisibilitySink implements ReportVisibilitySink {

	@Override
	public void hideTarget(ReportTargetType type, long targetId) {
	}
}
