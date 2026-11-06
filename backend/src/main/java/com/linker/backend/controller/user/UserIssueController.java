package com.linker.backend.controller.user;

import com.linker.backend.dto.issue.request.IssueEditRequest;
import com.linker.backend.dto.issue.request.IssueListQuery;
import com.linker.backend.dto.issue.response.IssueDetailResponse;
import com.linker.backend.dto.issue.response.IssueFilterOptionsResponse;
import com.linker.backend.dto.issue.response.IssueListResponse;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.DeveloperOnly;
import com.linker.backend.service.user.UserIssueService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@io.swagger.v3.oas.annotations.responses.ApiResponses({
  @io.swagger.v3.oas.annotations.responses.ApiResponse(
      responseCode = "400",
      description = "잘못된 조건 또는 커서",
      content =
          @io.swagger.v3.oas.annotations.media.Content(
              schema =
                  @io.swagger.v3.oas.annotations.media.Schema(
                      implementation = com.linker.backend.global.error.ApiErrorBody.class))),
  @io.swagger.v3.oas.annotations.responses.ApiResponse(
      responseCode = "401",
      description = "LOGIN_REQUIRED"),
  @io.swagger.v3.oas.annotations.responses.ApiResponse(
      responseCode = "403",
      description = "DEVELOPER_ONLY, TEAM_ROLE_REQUIRED, FORBIDDEN 또는 PLAN_LIMIT"),
  @io.swagger.v3.oas.annotations.responses.ApiResponse(
      responseCode = "409",
      description = "STATE_CONFLICT"),
  @io.swagger.v3.oas.annotations.responses.ApiResponse(
      responseCode = "429",
      description = "RATE_LIMITED"),
  @io.swagger.v3.oas.annotations.responses.ApiResponse(
      responseCode = "503",
      description = "SERVICE_UNAVAILABLE")
})
@RestController
@RequestMapping("/api/v1/user/teams/{teamId}")
public class UserIssueController {
  @org.springframework.web.bind.annotation.ExceptionHandler(
      org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
  public ResponseEntity<com.linker.backend.global.error.ApiErrorBody> invalidParameter() {
    return ResponseEntity.badRequest()
        .body(
            new com.linker.backend.global.error.ApiErrorBody(
                "VALIDATION_ERROR", "조회 조건을 확인해 주세요", null));
  }

  private final UserIssueService issues;
  private final com.linker.backend.service.user.UserIssueSyncService sync;
  private final com.linker.backend.service.user.UserIssueProgressService progress;

  public UserIssueController(
      UserIssueService issues,
      com.linker.backend.service.user.UserIssueSyncService sync,
      com.linker.backend.service.user.UserIssueProgressService progress) {
    this.issues = issues;
    this.sync = sync;
    this.progress = progress;
  }

  @GetMapping("/issues")
  @DeveloperOnly
  @Tag(name = "p11-issue-list")
  @Operation(operationId = "listTeamIssues", summary = "팀 이슈 목록 조회")
  public ResponseEntity<IssueListResponse> list(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable long teamId,
      @RequestParam(required = false) Long repo,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String assignee,
      @RequestParam(required = false) String label,
      @RequestParam(defaultValue = "false") boolean open,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int size) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(
            issues.list(
                user,
                teamId,
                new IssueListQuery(repo, status, assignee, label, open, cursor, size),
                false));
  }

  @GetMapping("/issues/unscheduled")
  @DeveloperOnly
  @Tag(name = "p11-issue-list")
  @Operation(operationId = "listUnscheduledTeamIssues", summary = "일정 없는 팀 이슈 조회")
  public ResponseEntity<IssueListResponse> unscheduled(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable long teamId,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int size) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(
            issues.list(
                user,
                teamId,
                new IssueListQuery(null, null, null, null, false, cursor, size),
                true));
  }

  @GetMapping("/issue-filters")
  @DeveloperOnly
  @Tag(name = "p11-issue-list")
  @Operation(operationId = "getTeamIssueFilterOptions", summary = "팀 이슈 필터 선택지 조회")
  public ResponseEntity<IssueFilterOptionsResponse> options(
      @AuthenticationPrincipal AuthenticatedUser user, @PathVariable long teamId) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(issues.options(user, teamId));
  }

  @org.springframework.web.bind.annotation.PostMapping("/issues/refresh")
  @DeveloperOnly
  @Tag(name = "p11-issue-list")
  @Operation(operationId = "refreshTeamIssues", summary = "현재 필터에 해당하는 이슈 갱신")
  public ResponseEntity<com.linker.backend.dto.issue.response.IssueRefreshResponse> refresh(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable long teamId,
      @RequestParam(required = false) Long repo,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String assignee,
      @RequestParam(required = false) String label,
      @RequestParam(defaultValue = "false") boolean open,
      @RequestParam(defaultValue = "all") String view) {
    if (!java.util.Set.of("all", "unscheduled").contains(view)) throw IssueListQuery.invalid();
    var query = new IssueListQuery(repo, status, assignee, label, open, null, 20);
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(sync.refresh(user, teamId, query, "unscheduled".equals(view)));
  }

  @org.springframework.web.bind.annotation.PostMapping("/issues/{issueId}/project-item")
  @DeveloperOnly
  @Tag(name = "p11-issue-list")
  @Operation(operationId = "addTeamIssueToProject", summary = "팀 프로젝트에 이슈 추가")
  @io.swagger.v3.oas.annotations.responses.ApiResponse(
      responseCode = "204",
      description = "GitHub 추가 및 캐시 재조회 완료")
  public ResponseEntity<Void> add(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable long teamId,
      @PathVariable long issueId) {
    if (issueId <= 0) throw IssueListQuery.invalid();
    sync.addToProject(user, teamId, issueId);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/progress")
  @DeveloperOnly
  @Tag(name = "p11-issue-list")
  @Operation(operationId = "getTeamIssueProgress", summary = "Flex 팀 진행 현황 조회")
  public ResponseEntity<com.linker.backend.dto.issue.response.IssueProgressResponse> progress(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable long teamId,
      @RequestParam(required = false) Integer days) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(
            progress.progress(
                user,
                teamId,
                days == null
                    ? com.linker.backend.global.config.PlanLimits.ISSUE_PROGRESS_DAYS
                    : days));
  }

  @GetMapping("/issues/{issueId}")
  @DeveloperOnly
  @Tag(name = "p12-issue-detail")
  @Operation(operationId = "detailTeamIssue", summary = "이슈 상세 조회")
  public ResponseEntity<IssueDetailResponse> detail(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable long teamId,
      @PathVariable long issueId) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(issues.detail(user, teamId, issueId));
  }

  @GetMapping("/issues/{issueId}/assignee-candidates")
  @DeveloperOnly
  @Tag(name = "p12-issue-detail")
  @Operation(operationId = "candidatesTeamIssue", summary = "이슈 담당자 후보 조회")
  public ResponseEntity<IssueDetailResponse.Candidates> candidates(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable long teamId,
      @PathVariable long issueId) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(issues.candidates(user, teamId, issueId));
  }

  @GetMapping("/issues/{issueId}/label-options")
  @DeveloperOnly
  @Tag(name = "p12-issue-detail")
  @Operation(operationId = "labelOptionsTeamIssue", summary = "저장소 라벨 선택지 조회")
  public ResponseEntity<IssueDetailResponse.LabelOptions> labelOptions(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable long teamId,
      @PathVariable long issueId) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(issues.labelOptions(user, teamId, issueId));
  }

  @GetMapping("/issues/{issueId}/sub-issues")
  @DeveloperOnly
  @Tag(name = "p12-issue-detail")
  @Operation(operationId = "subIssuesTeamIssue", summary = "하위 이슈 진행 조회")
  public ResponseEntity<IssueDetailResponse.SubIssues> subIssues(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable long teamId,
      @PathVariable long issueId) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(issues.subIssues(user, teamId, issueId));
  }

  @org.springframework.web.bind.annotation.PutMapping("/issues/{issueId}/assignees")
  @DeveloperOnly
  @Tag(name = "p12-issue-detail")
  @Operation(operationId = "updateTeamIssueAssignees", summary = "이슈 담당자 변경")
  public ResponseEntity<IssueDetailResponse.AssigneesResult> updateAssignees(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable long teamId,
      @PathVariable long issueId,
      @jakarta.validation.Valid @org.springframework.web.bind.annotation.RequestBody
          IssueEditRequest.Assignees request) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(issues.assignees(user, teamId, issueId, request.userIds()));
  }

  @org.springframework.web.bind.annotation.PutMapping("/issues/{issueId}/labels")
  @DeveloperOnly
  @Tag(name = "p12-issue-detail")
  @Operation(operationId = "updateTeamIssueLabels", summary = "이슈 라벨 변경")
  public ResponseEntity<IssueDetailResponse.LabelsResult> updateLabels(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable long teamId,
      @PathVariable long issueId,
      @jakarta.validation.Valid @org.springframework.web.bind.annotation.RequestBody
          IssueEditRequest.Labels request) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(issues.labels(user, teamId, issueId, request.labels()));
  }

  @org.springframework.web.bind.annotation.PutMapping("/issues/{issueId}/schedule")
  @DeveloperOnly
  @Tag(name = "p12-issue-detail")
  @Operation(operationId = "updateTeamIssueSchedule", summary = "이슈 시작일·마감일 변경")
  public ResponseEntity<IssueDetailResponse.ScheduleResult> updateSchedule(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable long teamId,
      @PathVariable long issueId,
      @jakarta.validation.Valid @org.springframework.web.bind.annotation.RequestBody
          IssueEditRequest.Schedule request) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(issues.schedule(user, teamId, issueId, request.startDate(), request.dueDate()));
  }

  @org.springframework.web.bind.annotation.PutMapping("/issues/{issueId}/status")
  @DeveloperOnly
  @Tag(name = "p12-issue-detail")
  @Operation(operationId = "updateTeamIssueStatus", summary = "이슈 상태 변경")
  public ResponseEntity<IssueDetailResponse.StatusResult> updateStatus(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable long teamId,
      @PathVariable long issueId,
      @jakarta.validation.Valid @org.springframework.web.bind.annotation.RequestBody
          IssueEditRequest.Status request) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(issues.status(user, teamId, issueId, request.status()));
  }

  @GetMapping("/issue-templates")
  @DeveloperOnly
  @Tag(name = "p13-issue-create")
  @Operation(operationId = "listIssueTemplates", summary = "이슈 템플릿과 작성 선택지 조회")
  public ResponseEntity<com.linker.backend.dto.issue.response.IssueTemplateResponse.ListResponse>
      templates(
          @AuthenticationPrincipal AuthenticatedUser u,
          @PathVariable long teamId,
          @RequestParam long repoId) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(issues.templates(u, teamId, repoId));
  }

  @GetMapping("/issue-templates/{templateKey}")
  @DeveloperOnly
  @Tag(name = "p13-issue-create")
  @Operation(operationId = "getIssueTemplate", summary = "이슈 템플릿 내용 조회")
  public ResponseEntity<com.linker.backend.dto.issue.response.IssueTemplateResponse> template(
      @AuthenticationPrincipal AuthenticatedUser u,
      @PathVariable long teamId,
      @PathVariable String templateKey,
      @RequestParam long repoId) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(issues.template(u, teamId, repoId, templateKey));
  }

  @org.springframework.web.bind.annotation.PostMapping("/issues")
  @DeveloperOnly
  @Tag(name = "p13-issue-create")
  @Operation(operationId = "createTeamIssue", summary = "GitHub 이슈 생성과 보드 반영 요청")
  @io.swagger.v3.oas.annotations.responses.ApiResponse(
      responseCode = "202",
      description = "생성 작업 접수·진행 상태")
  public ResponseEntity<com.linker.backend.dto.issue.response.IssueCreateResponse> create(
      @AuthenticationPrincipal AuthenticatedUser u,
      @PathVariable long teamId,
      @jakarta.validation.Valid @org.springframework.web.bind.annotation.RequestBody
          com.linker.backend.dto.issue.request.IssueCreateRequest request) {
    return ResponseEntity.accepted()
        .cacheControl(CacheControl.noStore())
        .body(issues.create(u, teamId, request));
  }

  @GetMapping("/issue-sync-jobs/{jobId}")
  @DeveloperOnly
  @Tag(name = "p13-issue-create")
  @Operation(operationId = "getIssueCreationProgress", summary = "이슈 생성 진행 상태 조회")
  public ResponseEntity<com.linker.backend.dto.issue.response.IssueCreateResponse> creationProgress(
      @AuthenticationPrincipal AuthenticatedUser u,
      @PathVariable long teamId,
      @PathVariable long jobId) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(issues.creationProgress(u, teamId, jobId));
  }
}
