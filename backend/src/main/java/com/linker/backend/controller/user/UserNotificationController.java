package com.linker.backend.controller.user;

import com.linker.backend.dto.notification.request.PushNotificationRequest;
import com.linker.backend.dto.notification.response.PushNotificationResponse;
import com.linker.backend.dto.notification.response.UnreadCountResponse;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.service.user.UserNotificationService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/user")
public class UserNotificationController {

	private final UserNotificationService notifications;

	public UserNotificationController(UserNotificationService notifications) {
		this.notifications = notifications;
	}

	@PatchMapping("/me/settings/notifications")
	@Tag(name = "p06-settings")
	@Operation(operationId = "updatePushNotifications")
	public ResponseEntity<PushNotificationResponse> updatePush(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody PushNotificationRequest request) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(new PushNotificationResponse(notifications.setPushEnabled(user, request.pushEnabled())));
	}

	@GetMapping("/notifications/unread-count")
	@Tag(name = "p18-notifications")
	@Operation(operationId = "getUnreadNotificationCount")
	public ResponseEntity<UnreadCountResponse> unreadCount(@AuthenticationPrincipal AuthenticatedUser user) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(new UnreadCountResponse(notifications.unreadCount(user)));
	}
}
