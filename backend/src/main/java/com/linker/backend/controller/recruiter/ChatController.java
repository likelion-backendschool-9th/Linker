package com.linker.backend.controller.recruiter;

import com.linker.backend.dto.chat.request.StartRecruiterChatRequest;
import com.linker.backend.dto.chat.response.RecruiterOfferResponses.FirstMessage;
import com.linker.backend.dto.chat.response.RecruiterOfferResponses.OfferCounts;
import com.linker.backend.dto.chat.response.RecruiterOfferResponses.OfferList;
import com.linker.backend.dto.chat.response.RecruiterOfferResponses.OfferSummary;
import com.linker.backend.dto.chat.response.StartDirectChatResponse;
import com.linker.backend.global.error.ApiErrorBody;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.service.recruiter.ChatService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
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

@RestController("recruiterChatController")
@RequestMapping("/recruiter")
public class ChatController {

	private final ChatService offers;

	public ChatController(ChatService offers) {
		this.offers = offers;
	}

	@GetMapping("/offers")
	@Tag(name = "p33-recruiter-offers")
	@Operation(operationId = "listRecruiterOffers")
	public ResponseEntity<OfferList> list(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestParam(required = false) String status) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(offers.list(user, status));
	}

	@GetMapping("/offers/counts")
	@Tag(name = "p33-recruiter-offers")
	@Operation(operationId = "countRecruiterOffers")
	public ResponseEntity<OfferCounts> counts(@AuthenticationPrincipal AuthenticatedUser user) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(offers.counts(user));
	}

	@GetMapping("/offers/summary")
	@Tag(name = "p33-recruiter-offers")
	@Operation(operationId = "summarizeRecruiterOffers")
	public ResponseEntity<OfferSummary> summary(@AuthenticationPrincipal AuthenticatedUser user) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(offers.summary(user));
	}

	@GetMapping("/offers/{roomId}/first-message")
	@Tag(name = "p33-recruiter-offers")
	@Operation(operationId = "getRecruiterOfferFirstMessage")
	public ResponseEntity<FirstMessage> firstMessage(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable long roomId) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(offers.firstMessage(user, roomId));
	}

	@PostMapping("/chat-requests")
	@Tag(name = "p17-chat-room")
	@Operation(operationId = "startRecruiterChat")
	@ApiResponse(responseCode = "200", description = "Open 1:1 room with the developer")
	@ApiResponse(responseCode = "400", description = "VALIDATION_ERROR (userId, yourself)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "403", description = "SUSPENDED or FORBIDDEN", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "404", description = "NOT_FOUND (missing, not a developer, or blocked either way)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<StartDirectChatResponse> start(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody StartRecruiterChatRequest request) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(offers.openChat(user, request));
	}
}
