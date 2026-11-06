package com.linker.backend.controller.user;

import java.security.Principal;
import java.util.Map;

import com.linker.backend.dto.chat.request.EditChatMessageRequest;
import com.linker.backend.dto.chat.request.MarkChatReadRequest;
import com.linker.backend.dto.chat.request.UpdateChatNotificationRequest;
import com.linker.backend.dto.chat.request.ShareChatCardRequest;
import com.linker.backend.dto.chat.response.AcceptChatRequestResponse;
import com.linker.backend.dto.chat.response.ChatMessagePageResponse;
import com.linker.backend.dto.chat.response.ChatMessageResponse;
import com.linker.backend.dto.chat.response.ChatMentionCandidatesResponse;
import com.linker.backend.dto.chat.response.ChatRoomInfoResponse;
import com.linker.backend.dto.chat.response.ChatRoomPageResponse;
import com.linker.backend.dto.chat.response.UnreadMembersResponse;
import com.linker.backend.dto.chat.response.UnreadSummaryResponse;
import com.linker.backend.global.realtime.StompAuthException;
import com.linker.backend.global.realtime.StompPrincipal;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.service.user.ChatService;

import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * ChatController (WBS S09). STOMP SEND stays here. Page 16 list and request actions are REST.
 */
@RestController("userChatController")
@RequestMapping("/user")
public class ChatController {

	private final ChatService chat;

	public ChatController(ChatService chat) {
		this.chat = chat;
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
	public ResponseEntity<ChatRoomPageResponse> list(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestParam(required = false) String tab,
			@RequestParam(required = false) String cursor
	) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(chat.list(user, tab, cursor));
	}

	@GetMapping("/chat-rooms/unread-summary")
	@Tag(name = "p16-chat-list")
	@Operation(operationId = "unreadChatSummary")
	public ResponseEntity<UnreadSummaryResponse> unreadSummary(@AuthenticationPrincipal AuthenticatedUser user) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(chat.unreadSummary(user));
	}

	@GetMapping("/chat-rooms/{roomId}")
	@Tag(name = "p17-chat-room")
	@Operation(operationId = "getChatRoom")
	public ResponseEntity<ChatRoomInfoResponse> room(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long roomId
	) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(chat.room(user, roomId));
	}

	@GetMapping("/chat-rooms/{roomId}/messages")
	@Tag(name = "p17-chat-room")
	@Operation(operationId = "listChatMessages")
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
	public ResponseEntity<ChatMentionCandidatesResponse> mentionCandidates(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long roomId
	) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(chat.mentionCandidates(user, roomId));
	}

	@PostMapping("/chat-rooms/{roomId}/share-cards")
	@Tag(name = "p17-chat-room")
	@Operation(operationId = "shareChatCard")
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
	public ResponseEntity<Void> leave(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long roomId
	) {
		chat.leave(user, roomId);
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/chat-requests/{roomId}/accept")
	@Tag(name = "p16-chat-list")
	@Operation(operationId = "acceptChatRequest")
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
