package com.linker.backend.controller.user;

import com.linker.backend.dto.notification.request.PushNotificationRequest;
import com.linker.backend.dto.notification.request.RegisterPushTokenRequest;
import com.linker.backend.dto.notification.response.NotificationPageResponse;
import com.linker.backend.dto.notification.response.PushNotificationResponse;
import com.linker.backend.dto.notification.response.UnreadCountResponse;
import com.linker.backend.global.error.ApiErrorBody;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.service.user.NotificationService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * NotificationController (WBS S10, page 18 and the page 06 push switch). Error responses list the codes
 * each method can return ({@code {code, message, detail}}). Every route also answers 401
 * {@code LOGIN_REQUIRED}, and writes answer 403 {@code SUSPENDED} for a suspended account.
 */
@RestController("userNotificationController")
@RequestMapping("/user")
public class NotificationController {

	private final NotificationService notifications;

	public NotificationController(NotificationService notifications) {
		this.notifications = notifications;
	}

	/** A non-numeric notification id is a bad request, not a server error. */
	@ExceptionHandler({MethodArgumentTypeMismatchException.class, MissingServletRequestParameterException.class})
	public ResponseEntity<ApiErrorBody> invalidParameter() {
		return ResponseEntity.badRequest().body(new ApiErrorBody("VALIDATION_ERROR", "요청 값을 확인해 주세요", null));
	}

	@PatchMapping("/me/settings/notifications")
	@Tag(name = "p06-settings")
	@Operation(operationId = "updatePushNotifications")
	@ApiResponse(responseCode = "200", description = "Saved push switch")
	@ApiResponse(responseCode = "400", description = "VALIDATION_ERROR (pushEnabled missing)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "403", description = "SUSPENDED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "404", description = "NOT_FOUND (account deleted)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<PushNotificationResponse> updatePush(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody PushNotificationRequest request) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(new PushNotificationResponse(notifications.setPushEnabled(user, request.pushEnabled())));
	}

	@GetMapping("/notifications")
	@Tag(name = "p18-notifications")
	@Operation(operationId = "listNotifications")
	@ApiResponse(responseCode = "200", description = "Notification page")
	@ApiResponse(responseCode = "400", description = "VALIDATION_ERROR (cursor)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<NotificationPageResponse> list(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestParam(required = false) String cursor
	) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(notifications.list(user, cursor));
	}

	@PatchMapping("/notifications/{notificationId}/read")
	@Tag(name = "p18-notifications")
	@Operation(operationId = "markNotificationRead")
	@ApiResponse(responseCode = "204", description = "Own notification marked read")
	@ApiResponse(responseCode = "400", description = "VALIDATION_ERROR (notification id)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "403", description = "SUSPENDED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "404", description = "NOT_FOUND (missing or someone else's)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<Void> markRead(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long notificationId
	) {
		notifications.markRead(user, notificationId);
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/notifications/read-all")
	@Tag(name = "p18-notifications")
	@Operation(operationId = "markAllNotificationsRead")
	@ApiResponse(responseCode = "204", description = "Visible unread notifications marked read")
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "403", description = "SUSPENDED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<Void> markAllRead(@AuthenticationPrincipal AuthenticatedUser user) {
		notifications.markAllRead(user);
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/push-tokens")
	@Tag(name = "p18-notifications")
	@Operation(operationId = "registerPushToken")
	@ApiResponse(responseCode = "204", description = "Android token stored or moved to this account")
	@ApiResponse(responseCode = "400", description = "VALIDATION_ERROR (empty or long token, platform other than Android)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "403", description = "SUSPENDED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "404", description = "NOT_FOUND (account deleted)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<Void> registerPushToken(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody RegisterPushTokenRequest request
	) {
		notifications.registerPushToken(user, request.token(), request.platform());
		return ResponseEntity.noContent().build();
	}

	@DeleteMapping("/push-tokens/{token}")
	@Tag(name = "p18-notifications")
	@Operation(operationId = "deletePushToken")
	@ApiResponse(responseCode = "204", description = "Own token deleted")
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "403", description = "SUSPENDED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "404", description = "NOT_FOUND (unknown or someone else's token)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<Void> deletePushToken(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable String token
	) {
		notifications.deletePushToken(user, token);
		return ResponseEntity.noContent().build();
	}

	@GetMapping("/notifications/unread-count")
	@Tag(name = "p18-notifications")
	@Operation(operationId = "getUnreadNotificationCount")
	@ApiResponse(responseCode = "200", description = "Unread count")
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<UnreadCountResponse> unreadCount(@AuthenticationPrincipal AuthenticatedUser user) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(new UnreadCountResponse(notifications.unreadCount(user)));
	}
}
