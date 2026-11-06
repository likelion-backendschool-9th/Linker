package com.linker.backend.global.realtime;

import java.time.Clock;

import com.linker.backend.repository.chat.ChatRoomMemberRepository;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class MembershipChatRoomAccess implements ChatRoomAccess {

	private final ChatRoomMemberRepository members;
	private final Clock clock;

	public MembershipChatRoomAccess(ChatRoomMemberRepository members, Clock clock) {
		this.members = members;
		this.clock = clock;
	}

	@Override
	@Transactional(readOnly = true)
	public boolean canSubscribe(long userId, long roomId) {
		return members.findActive(roomId, userId)
				.map(member -> member.getRoom().admitsSubscriber(clock.instant()))
				.orElse(false);
	}

	@Override
	@Transactional(readOnly = true)
	public boolean canSend(long userId, long roomId) {
		return members.findActive(roomId, userId)
				.map(member -> member.getRoom().admitsSender())
				.orElse(false);
	}
}
