package com.linker.backend.global.realtime;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.linker.backend.global.security.AuthenticatedUser;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

/**
 * Binds the handshake user onto the STOMP session and guards SEND/SUBSCRIBE destinations.
 */
@Component
public class StompChannelInterceptor implements ChannelInterceptor {

	private static final Pattern ROOM_TOPIC = Pattern.compile("^/topic/chat-rooms/(\\d+)$");
	private static final Pattern ROOM_SEND = Pattern.compile("^/app/chat-rooms/(\\d+)/messages$");
	private static final Pattern USER_QUEUE = Pattern.compile("^/user/queue/(chat-rooms|notifications)$");

	private final ChatRoomAccess chatRooms;

	public StompChannelInterceptor(ChatRoomAccess chatRooms) {
		this.chatRooms = chatRooms;
	}

	@Override
	public Message<?> preSend(Message<?> message, MessageChannel channel) {
		StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
		if (accessor == null || accessor.getCommand() == null) {
			return message;
		}
		StompCommand command = accessor.getCommand();
		if (command == StompCommand.CONNECT) {
			bindUser(accessor);
			return message;
		}
		AuthenticatedUser user = requireUser(accessor);
		if (command == StompCommand.SUBSCRIBE) {
			authorizeSubscribe(user, accessor.getDestination());
		}
		else if (command == StompCommand.SEND) {
			authorizeSend(user, accessor.getDestination());
		}
		return message;
	}

	private void bindUser(StompHeaderAccessor accessor) {
		Object attribute = accessor.getSessionAttributes() == null
				? null
				: accessor.getSessionAttributes().get(StompHandshakeInterceptor.USER_ATTRIBUTE);
		if (!(attribute instanceof AuthenticatedUser user)) {
			throw new StompAuthException("로그인이 필요해요");
		}
		accessor.setUser(new StompPrincipal(user));
	}

	private AuthenticatedUser requireUser(StompHeaderAccessor accessor) {
		if (accessor.getUser() instanceof StompPrincipal principal) {
			return principal.user();
		}
		Object attribute = accessor.getSessionAttributes() == null
				? null
				: accessor.getSessionAttributes().get(StompHandshakeInterceptor.USER_ATTRIBUTE);
		if (attribute instanceof AuthenticatedUser user) {
			accessor.setUser(new StompPrincipal(user));
			return user;
		}
		throw new StompAuthException("로그인이 필요해요");
	}

	private void authorizeSubscribe(AuthenticatedUser user, String destination) {
		if (destination == null) {
			throw new StompAuthException("구독 경로를 확인해 주세요");
		}
		if (USER_QUEUE.matcher(destination).matches()) {
			return;
		}
		Matcher room = ROOM_TOPIC.matcher(destination);
		if (room.matches()) {
			long roomId = Long.parseLong(room.group(1));
			if (!chatRooms.canParticipate(user.userId(), roomId)) {
				throw new StompAuthException("채팅방에 참여할 수 없어요");
			}
			return;
		}
		throw new StompAuthException("구독할 수 없는 경로예요");
	}

	private void authorizeSend(AuthenticatedUser user, String destination) {
		if (destination == null) {
			throw new StompAuthException("전송 경로를 확인해 주세요");
		}
		Matcher room = ROOM_SEND.matcher(destination);
		if (!room.matches()) {
			throw new StompAuthException("전송할 수 없는 경로예요");
		}
		long roomId = Long.parseLong(room.group(1));
		if (!chatRooms.canParticipate(user.userId(), roomId)) {
			throw new StompAuthException("채팅방에 참여할 수 없어요");
		}
	}
}
