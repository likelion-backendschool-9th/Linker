package com.linker.backend.controller.user;

import java.security.Principal;
import java.util.Map;

import com.linker.backend.dto.chat.request.EditChatMessageRequest;
import com.linker.backend.dto.chat.request.MarkChatReadRequest;
import com.linker.backend.dto.chat.request.UpdateChatNotificationRequest;
import com.linker.backend.dto.chat.request.ShareChatCardRequest;
import com.linker.backend.dto.chat.request.StartDirectChatRequest;
import com.linker.backend.dto.chat.response.AcceptChatRequestResponse;
import com.linker.backend.dto.chat.response.StartDirectChatResponse;
import com.linker.backend.dto.chat.response.ChatMessagePageResponse;
import com.linker.backend.dto.chat.response.ChatMessageResponse;
import com.linker.backend.dto.chat.response.ChatMentionCandidatesResponse;
import com.linker.backend.dto.chat.response.ChatRoomInfoResponse;
import com.linker.backend.dto.chat.response.ChatRoomPageResponse;
import com.linker.backend.dto.chat.response.UnreadMembersResponse;
import com.linker.backend.dto.chat.response.UnreadSummaryResponse;
import com.linker.backend.global.error.ApiErrorBody;
import com.linker.backend.global.realtime.StompAuthException;
import com.linker.backend.global.realtime.StompPrincipal;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.DeveloperOnly;
import com.linker.backend.service.user.ChatService;

import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
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
 * ChatController (WBS S09). STOMP SEND stays here. Page 16 list and request actions are REST.
 * Error responses list the codes each method can return ({@code {code, message, detail}}, foundation
 * contract §3). Every route also answers 401 {@code LOGIN_REQUIRED}, and writes answer 403
 * {@code SUSPENDED} for a suspended account.
 */
@RestController("userChatController")
@RequestMapping("/user")
public class ChatController {

	private final ChatService chat;

	public ChatController(ChatService chat) {
		this.chat = chat;
	}

	/** A non-numeric room or message id is a bad request, not a server error. */
	@ExceptionHandler({MethodArgumentTypeMismatchException.class, MissingServletRequestParameterException.class})
	public ResponseEntity<ApiErrorBody> invalidParameter() {
		return ResponseEntity.badRequest().body(new ApiErrorBody("VALIDATION_ERROR", "요청 값을 확인해 주세요", null));
	}

	@Hidden
	@MessageMapping("/chat-rooms/{roomId}/messages")
	public void sendMessage(
			@DestinationVariable long roomId,
			@Payload Map<String, Object> payload,
			Principal principal
	) {
		chat.sendMessage(requireUserId(principal), roomId, payload);
	}

	@GetMapping("/chat-rooms")
	@Tag(name = "p16-chat-list")
	@Operation(operationId = "listChatRooms")
	@ApiResponse(responseCode = "200", description = "Room list page")
	@ApiResponse(responseCode = "400", description = "VALIDATION_ERROR (tab, cursor)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "403", description = "FORBIDDEN (tab not open to recruiters)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<ChatRoomPageResponse> list(
			@AuthenticationPrincipal AuthenticatedUser user,
			@Parameter(schema = @Schema(allowableValues = {"TEAM", "DIRECT", "REQUEST"}, defaultValue = "TEAM"))
			@RequestParam(required = false) String tab,
			@RequestParam(required = false) String cursor
	) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(chat.list(user, tab, cursor));
	}

	@GetMapping("/chat-rooms/unread-summary")
	@Tag(name = "p16-chat-list")
	@Operation(operationId = "unreadChatSummary")
	@ApiResponse(responseCode = "200", description = "Unread counts per tab")
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<UnreadSummaryResponse> unreadSummary(@AuthenticationPrincipal AuthenticatedUser user) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(chat.unreadSummary(user));
	}

	@GetMapping("/chat-rooms/{roomId}")
	@Tag(name = "p17-chat-room")
	@Operation(operationId = "getChatRoom")
	@ApiResponse(responseCode = "200", description = "Room info")
	@ApiResponse(responseCode = "400", description = "VALIDATION_ERROR (room id)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "404", description = "NOT_FOUND (not a participant, blocked, expired request)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<ChatRoomInfoResponse> room(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long roomId
	) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(chat.room(user, roomId));
	}

	@GetMapping("/chat-rooms/{roomId}/messages")
	@Tag(name = "p17-chat-room")
	@Operation(operationId = "listChatMessages")
	@ApiResponse(responseCode = "200", description = "Message page")
	@ApiResponse(responseCode = "400", description = "VALIDATION_ERROR (before/after, anchor outside the room)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "404", description = "NOT_FOUND (not a participant)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<ChatMessagePageResponse> messages(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long roomId,
			@RequestParam(required = false) Long before,
			@RequestParam(required = false) Long after
	) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(chat.messages(user, roomId, before, after));
	}

	@GetMapping("/chat-rooms/{roomId}/mention-candidates")
	@Tag(name = "p17-chat-room")
	@Operation(operationId = "listChatMentionCandidates")
	@ApiResponse(responseCode = "200", description = "Mention candidates")
	@ApiResponse(responseCode = "400", description = "VALIDATION_ERROR (room id)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "403", description = "FORBIDDEN (not a team room or team member)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "404", description = "NOT_FOUND", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<ChatMentionCandidatesResponse> mentionCandidates(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long roomId
	) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(chat.mentionCandidates(user, roomId));
	}

	@PostMapping("/chat-rooms/{roomId}/share-cards")
	@Tag(name = "p17-chat-room")
	@Operation(operationId = "shareChatCard")
	@ApiResponse(responseCode = "200", description = "Stored SHARE_CARD message")
	@ApiResponse(responseCode = "400", description = "VALIDATION_ERROR (target, clientMessageId)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "403", description = "SUSPENDED or FORBIDDEN (room not writable)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "404", description = "NOT_FOUND", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "429", description = "RATE_LIMITED (detail.retryAfterSeconds)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<ChatMessageResponse> shareCard(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long roomId,
			@RequestBody ShareChatCardRequest request
	) {
		return ResponseEntity.ok().body(chat.shareCard(user, roomId, request));
	}

	@PostMapping("/chat-rooms/{roomId}/read")
	@Tag(name = "p17-chat-room")
	@Operation(operationId = "markChatRead")
	@ApiResponse(responseCode = "204", description = "Read pointer advanced or already ahead")
	@ApiResponse(responseCode = "400", description = "VALIDATION_ERROR (message not visible to the caller or in another room)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "403", description = "SUSPENDED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "404", description = "NOT_FOUND (not a participant)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<Void> read(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long roomId,
			@RequestBody MarkChatReadRequest request
	) {
		chat.markRead(user, roomId, request);
		return ResponseEntity.noContent().build();
	}

	@PatchMapping("/chat-rooms/{roomId}/messages/{messageId}")
	@Tag(name = "p17-chat-room")
	@Operation(operationId = "editChatMessage")
	@ApiResponse(responseCode = "200", description = "Edited message")
	@ApiResponse(responseCode = "400", description = "VALIDATION_ERROR (empty or over 2,000 chars)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "403", description = "SUSPENDED or FORBIDDEN (not the author, not text)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "404", description = "NOT_FOUND", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "409", description = "STATE_CONFLICT (deleted, hidden, past 24 hours)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<ChatMessageResponse> edit(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long roomId,
			@PathVariable long messageId,
			@RequestBody EditChatMessageRequest request
	) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(chat.edit(user, roomId, messageId, request));
	}

	@DeleteMapping("/chat-rooms/{roomId}/messages/{messageId}")
	@Tag(name = "p17-chat-room")
	@Operation(operationId = "deleteChatMessage")
	@ApiResponse(responseCode = "204", description = "Message soft-deleted or already deleted by the author")
	@ApiResponse(responseCode = "400", description = "VALIDATION_ERROR (ids)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "403", description = "SUSPENDED or FORBIDDEN (not the author or a team owner/admin, system message)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "404", description = "NOT_FOUND", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "409", description = "STATE_CONFLICT", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<Void> deleteMessage(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long roomId,
			@PathVariable long messageId
	) {
		chat.deleteMessage(user, roomId, messageId);
		return ResponseEntity.noContent().build();
	}

	@GetMapping("/chat-rooms/{roomId}/messages/{messageId}/unread-members")
	@Tag(name = "p17-chat-room")
	@Operation(operationId = "listUnreadChatMembers")
	@ApiResponse(responseCode = "200", description = "Members who have not read the message")
	@ApiResponse(responseCode = "400", description = "VALIDATION_ERROR (ids)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "403", description = "FORBIDDEN (not a team room)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "404", description = "NOT_FOUND", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<UnreadMembersResponse> unreadMembers(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long roomId,
			@PathVariable long messageId
	) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(chat.unreadMembers(user, roomId, messageId));
	}

	@PatchMapping("/chat-rooms/{roomId}/notification")
	@Tag(name = "p17-chat-room")
	@Operation(operationId = "updateChatNotification")
	@ApiResponse(responseCode = "204", description = "Caller's mute preference stored")
	@ApiResponse(responseCode = "400", description = "VALIDATION_ERROR (muted)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "403", description = "SUSPENDED or FORBIDDEN", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "404", description = "NOT_FOUND", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<Void> notification(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long roomId,
			@RequestBody UpdateChatNotificationRequest request
	) {
		chat.updateNotification(user, roomId, request);
		return ResponseEntity.noContent().build();
	}

	@DeleteMapping("/chat-rooms/{roomId}/members/me")
	@Tag(name = "p17-chat-room")
	@Operation(operationId = "leaveChatRoom")
	@ApiResponse(responseCode = "204", description = "Chat room membership ended")
	@ApiResponse(responseCode = "400", description = "VALIDATION_ERROR (room id)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "403", description = "SUSPENDED or FORBIDDEN", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "404", description = "NOT_FOUND", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<Void> leave(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long roomId
	) {
		chat.leave(user, roomId);
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/chat-rooms/direct")
	@DeveloperOnly
	@Tag(name = "p17-chat-room")
	@Operation(operationId = "startDirectChat")
	@ApiResponse(responseCode = "200", description = "DIRECT room, a REQUEST room, or REQUEST with no room when a first message is needed")
	@ApiResponse(responseCode = "400", description = "VALIDATION_ERROR (userId, yourself, message over 2,000 chars)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "403", description = "DEVELOPER_ONLY, SUSPENDED or FORBIDDEN", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "404", description = "NOT_FOUND (missing, recruiter or blocked either way)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<StartDirectChatResponse> startDirect(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody StartDirectChatRequest request
	) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(chat.startDirect(user, request));
	}

	@PostMapping("/chat-requests/{roomId}/accept")
	@Tag(name = "p16-chat-list")
	@Operation(operationId = "acceptChatRequest")
	@ApiResponse(responseCode = "200", description = "Accepted room")
	@ApiResponse(responseCode = "400", description = "VALIDATION_ERROR (room id)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "403", description = "SUSPENDED or FORBIDDEN (the requester)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "404", description = "NOT_FOUND (also while either side blocks the other)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "409", description = "STATE_CONFLICT (already handled or expired)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<AcceptChatRequestResponse> accept(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long roomId
	) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(chat.accept(user, roomId));
	}

	@DeleteMapping("/chat-requests/{roomId}")
	@Tag(name = "p16-chat-list")
	@Operation(operationId = "deleteChatRequest")
	@ApiResponse(responseCode = "204", description = "Received request rejected")
	@ApiResponse(responseCode = "400", description = "VALIDATION_ERROR (room id)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "403", description = "SUSPENDED or FORBIDDEN (the requester)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "404", description = "NOT_FOUND", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "409", description = "STATE_CONFLICT (already handled or expired)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable long roomId) {
		chat.deleteRequest(user, roomId);
		return ResponseEntity.noContent().build();
	}

	private long requireUserId(Principal principal) {
		if (principal instanceof StompPrincipal stomp) {
			return stomp.user().userId();
		}
		throw new StompAuthException("로그인이 필요해요");
	}
}
