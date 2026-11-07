package com.linker.backend.controller.admin;

import com.linker.backend.dto.moderation.request.AppealDecisionRequest;
import com.linker.backend.dto.moderation.request.OtpVerifyRequest;
import com.linker.backend.dto.moderation.request.ReportActionRequest;
import com.linker.backend.dto.moderation.response.AppealListResponse;
import com.linker.backend.dto.moderation.response.OtpVerifyResponse;
import com.linker.backend.dto.moderation.response.ReportCaseListResponse;
import com.linker.backend.dto.moderation.response.ReportCaseListResponse.ReportCaseView;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.service.admin.ModerationService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import com.linker.backend.global.error.ApiErrorBody;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import com.linker.backend.dto.moderation.response.AdminUsersResponse;
import com.linker.backend.dto.moderation.request.AccountSanctionRequest;
import com.linker.backend.dto.moderation.request.EmailRevealRequest;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController("adminModerationController")
@RequestMapping("/admin")
public class ModerationController {

	private final ModerationService reports;

	public ModerationController(ModerationService reports) {
		this.reports = reports;
	}

	@PostMapping("/otp/verify")
	@Tag(name = "p25-admin-reports")
	@Operation(operationId = "verifyAdminOtp")
	public ResponseEntity<OtpVerifyResponse> verifyOtp(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody OtpVerifyRequest request) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(reports.verifyOtp(user, request));
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
  @GetMapping("/users")
  @Tag(name="p26-admin-users")
  @Operation(operationId="listAdminUsers")
  @ApiResponses({@ApiResponse(responseCode="400",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="401",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="403",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="404",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="409",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="503",content=@Content(schema=@Schema(implementation=ApiErrorBody.class)))})
  public ResponseEntity<AdminUsersResponse> users(@AuthenticationPrincipal AuthenticatedUser actor,
      @RequestParam(required=false) String q, @RequestParam(required=false) String status,
      @RequestParam(required=false) String userType, @RequestParam(required=false) Boolean needsReview,
      @RequestParam(required=false) Long cursor, @RequestParam(defaultValue="20") int size) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(reports.listUsers(actor,q,status,userType,needsReview,cursor,size));
  }
  @GetMapping("/users/{userId}")
  @Tag(name="p26-admin-users")
  @Operation(operationId="getAdminUser")
  @ApiResponses({@ApiResponse(responseCode="400",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="401",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="403",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="404",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="409",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="503",content=@Content(schema=@Schema(implementation=ApiErrorBody.class)))})
  public ResponseEntity<AdminUsersResponse.Detail> user(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long userId) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(reports.getUser(actor,userId));
  }
  @PostMapping("/users/{userId}/sanctions")
  @Tag(name="p26-admin-users")
  @Operation(operationId="sanctionAdminUser")
  @ApiResponses({@ApiResponse(responseCode="400",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="401",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="403",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="404",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="409",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="503",content=@Content(schema=@Schema(implementation=ApiErrorBody.class)))})
  public ResponseEntity<AdminUsersResponse.SanctionView> sanction(@AuthenticationPrincipal AuthenticatedUser actor,
      @PathVariable long userId,@RequestBody AccountSanctionRequest request) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(reports.sanctionUser(actor,userId,request));
  }
  @DeleteMapping("/users/{userId}/sanctions/{sanctionId}")
  @Tag(name="p26-admin-users")
  @Operation(operationId="liftAdminUserSanction")
  @ApiResponses({@ApiResponse(responseCode="400",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="401",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="403",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="404",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="409",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="503",content=@Content(schema=@Schema(implementation=ApiErrorBody.class)))})
  public ResponseEntity<Void> lift(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long userId,@PathVariable long sanctionId) {
    reports.liftUserSanction(actor,userId,sanctionId);
    return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
  }
  @PostMapping("/users/{userId}/email-reveal")
  @Tag(name="p26-admin-users")
  @Operation(operationId="revealAdminUserEmail")
  @ApiResponses({@ApiResponse(responseCode="400",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="401",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="403",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="404",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="409",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="503",content=@Content(schema=@Schema(implementation=ApiErrorBody.class)))})
  public ResponseEntity<AdminUsersResponse.RevealedEmail> reveal(@AuthenticationPrincipal AuthenticatedUser actor,
      @PathVariable long userId,@RequestBody EmailRevealRequest request) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(reports.revealUserEmail(actor,userId,request));
  }

  @GetMapping("/audit-logs")
  @Tag(name="p27-admin-audit")
  @Operation(operationId="listAdminAuditLogs")
  @ApiResponses({@ApiResponse(responseCode="400",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="401",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="403",content=@Content(schema=@Schema(implementation=ApiErrorBody.class)))})
  public ResponseEntity<com.linker.backend.dto.moderation.response.AuditLogsResponse> auditLogs(
      @AuthenticationPrincipal AuthenticatedUser actor,@RequestParam(required=false) Long adminId,
      @RequestParam(required=false) String actionType,
      @RequestParam(required=false) @org.springframework.format.annotation.DateTimeFormat(iso=org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from,
      @RequestParam(required=false) @org.springframework.format.annotation.DateTimeFormat(iso=org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to,
      @RequestParam(required=false) Long cursor,@RequestParam(defaultValue="20") int size) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(reports.auditLogs(actor,adminId,actionType,from,to,cursor,size));
  }
  @GetMapping("/audit-logs/filters")
  @Tag(name="p27-admin-audit")
  @Operation(operationId="getAdminAuditFilters")
  @ApiResponses({@ApiResponse(responseCode="400",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="401",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="403",content=@Content(schema=@Schema(implementation=ApiErrorBody.class)))})
  public ResponseEntity<com.linker.backend.dto.moderation.response.AuditLogsResponse.Filters> auditFilters(@AuthenticationPrincipal AuthenticatedUser actor) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(reports.auditFilters(actor));
  }

  // Keep malformed date/number handling within this controller instead of changing shared advice.
  @org.springframework.web.bind.annotation.ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
  public ResponseEntity<ApiErrorBody> invalidQueryType() {
    return ResponseEntity.badRequest().cacheControl(CacheControl.noStore())
        .body(new ApiErrorBody("VALIDATION_ERROR","요청 값을 확인해 주세요",null));
  }

}
