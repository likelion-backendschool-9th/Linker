package com.linker.backend.global.realtime;

/**
 * Room participation for STOMP. Subscribe and send are separate:
 * a pending request can be read by its members, and further sends stay closed.
 */
public interface ChatRoomAccess {

	boolean canSubscribe(long userId, long roomId);

	boolean canSend(long userId, long roomId);
}
