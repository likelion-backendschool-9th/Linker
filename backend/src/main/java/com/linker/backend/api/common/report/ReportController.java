package com.linker.backend.api.common.report;

import com.linker.backend.domain.moderation.ReportService;
import com.linker.backend.global.security.AuthenticatedUser;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ReportController {

	private final ReportService reports;

	public ReportController(ReportService reports) {
		this.reports = reports;
	}

	@PostMapping("/api/v1/user/reports")
	public ResponseEntity<Void> report(@AuthenticationPrincipal AuthenticatedUser user, @RequestBody CreateReportRequest request) {
		reports.report(user.userId(), request.targetType(), request.targetId(), request.reason(), request.detail());
		return ResponseEntity.noContent().build();
	}
}
