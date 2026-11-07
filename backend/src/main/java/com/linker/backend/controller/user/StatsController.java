package com.linker.backend.controller.user;

import com.linker.backend.dto.stats.response.*;
import com.linker.backend.global.error.ApiErrorBody;
import com.linker.backend.global.security.*;
import com.linker.backend.service.user.StatsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.*;
import io.swagger.v3.oas.annotations.media.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController("userStatsController")
@RequestMapping("/user/me/stats")
@Tag(name="p30-stats")
@ApiResponses({
    @ApiResponse(responseCode="400",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
    @ApiResponse(responseCode="401",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
    @ApiResponse(responseCode="403",content=@Content(schema=@Schema(implementation=ApiErrorBody.class)))})
public class StatsController {
  private final StatsService stats;
  public StatsController(StatsService stats) { this.stats=stats; }
  @DeveloperOnly
  @GetMapping("/summary")
  @Operation(operationId="getMyStatsSummary")
  public ResponseEntity<StatsSummaryResponse> summary(@AuthenticationPrincipal AuthenticatedUser actor) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(stats.summary(actor));
  }
  @DeveloperOnly
  @GetMapping("/recruiter-views")
  @Operation(operationId="getMyRecruiterViews")
  public ResponseEntity<RecruiterViewsResponse> recruiterViews(@AuthenticationPrincipal AuthenticatedUser actor,@RequestParam(required=false) Integer weeks) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(stats.recruiterViews(actor,weeks==null?com.linker.backend.global.config.PlanLimits.STATS_RECRUITER_WEEKS:weeks));
  }
  @DeveloperOnly
  @GetMapping("/posts")
  @Operation(operationId="getMyPostStats")
  public ResponseEntity<PostStatsResponse> postStats(@AuthenticationPrincipal AuthenticatedUser actor,@RequestParam(required=false) Integer days) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(stats.postStats(actor,days==null?com.linker.backend.global.config.PlanLimits.STATS_TREND_DAYS:days));
  }
  @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
  public ResponseEntity<ApiErrorBody> invalidQueryType() {
    return ResponseEntity.badRequest().cacheControl(CacheControl.noStore()).body(new ApiErrorBody("VALIDATION_ERROR","통계 조회 기간을 확인해 주세요",null));
  }
}
