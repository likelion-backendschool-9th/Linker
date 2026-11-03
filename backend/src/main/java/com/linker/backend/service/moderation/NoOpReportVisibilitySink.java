package com.linker.backend.service.moderation;

import com.linker.backend.entity.moderation.ReportTargetType;

import org.springframework.stereotype.Component;

@Component
public class NoOpReportVisibilitySink implements ReportVisibilitySink {

	@Override
	public void hideTarget(ReportTargetType type, long targetId) {
	}
}
