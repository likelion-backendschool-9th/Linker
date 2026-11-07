package com.linker.backend.controller.admin;

import com.linker.backend.dto.subscription.response.AdminRefundResponse;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.service.admin.SubscriptionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import com.linker.backend.global.error.ApiErrorBody;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController("adminSubscriptionController")
@RequestMapping("/admin/payments")
@Tag(name="p26-admin-users")
public class SubscriptionController {
  private final SubscriptionService subscriptions;
  public SubscriptionController(SubscriptionService subscriptions) { this.subscriptions=subscriptions; }
  @PostMapping("/{paymentId}/refund")
  @Operation(operationId="refundAdminPayment")
  @ApiResponses({@ApiResponse(responseCode="200",content=@Content(schema=@Schema(implementation=AdminRefundResponse.class))),
      @ApiResponse(responseCode="400",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="401",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="403",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="404",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="409",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="503",content=@Content(schema=@Schema(implementation=ApiErrorBody.class))),
      @ApiResponse(responseCode="502",content=@Content(schema=@Schema(implementation=ApiErrorBody.class)))})
  public ResponseEntity<AdminRefundResponse> refund(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long paymentId) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(subscriptions.refund(actor,paymentId));
  }
}
