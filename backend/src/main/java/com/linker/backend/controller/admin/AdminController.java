package com.linker.backend.controller.admin;

import com.linker.backend.dto.moderation.request.AppealDecisionRequest;
import com.linker.backend.dto.moderation.request.ReportActionRequest;
import com.linker.backend.dto.moderation.response.AppealListResponse;
import com.linker.backend.dto.moderation.response.ReportCaseListResponse;
import com.linker.backend.dto.moderation.response.ReportCaseListResponse.ReportCaseView;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.service.admin.AdminService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {

	private final AdminService reports;

	public AdminController(AdminService reports) {
		this.reports = reports;
	}

	@GetMapping("/report-cases")
	@Tag(name = "p25-admin-reports")
	@Operation(operationId = "listReportCases")
	public ResponseEntity<ReportCaseListResponse> listCases(
			@RequestParam(required = false) String status,
			@RequestParam(required = false) String targetType,
			@RequestParam(required = false) String overdue) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(reports.listCases(status, targetType, overdue));
	}

	@GetMapping("/report-cases/{caseId}")
	@Tag(name = "p25-admin-reports")
	@Operation(operationId = "getReportCase")
	public ResponseEntity<ReportCaseView> getCase(@PathVariable long caseId) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(reports.getCase(caseId));
	}

	@PostMapping("/report-cases/{caseId}/actions")
	@Tag(name = "p25-admin-reports")
	@Operation(operationId = "actOnReportCase")
	public ResponseEntity<ReportCaseView> act(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long caseId,
			@RequestBody ReportActionRequest request) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(reports.act(user, caseId, request));
	}

	@GetMapping("/appeals")
	@Tag(name = "p25-admin-reports")
	@Operation(operationId = "listAppeals")
	public ResponseEntity<AppealListResponse> listAppeals(@RequestParam(required = false) String status) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(reports.listAppeals(status));
	}

	@PostMapping("/appeals/{appealId}/decision")
	@Tag(name = "p25-admin-reports")
	@Operation(operationId = "decideAppeal")
	public ResponseEntity<Void> decideAppeal(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long appealId,
			@RequestBody AppealDecisionRequest request) {
		reports.decideAppeal(user, appealId, request);
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}
}
