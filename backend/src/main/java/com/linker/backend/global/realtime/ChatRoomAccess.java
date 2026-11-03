package com.linker.backend.global.realtime;

/**
 * Room participation check for STOMP SEND/SUBSCRIBE on chat destinations.
 * Chat tables land with page 16/17; until then the default bean only requires a signed-in user.
 */
public interface ChatRoomAccess {

	boolean canParticipate(long userId, long roomId);
}
