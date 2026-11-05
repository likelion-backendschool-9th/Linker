package com.linker.backend.global.realtime;

import com.linker.backend.repository.chat.ChatRoomMemberRepository;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class MembershipChatRoomAccess implements ChatRoomAccess {

	private final ChatRoomMemberRepository members;

	public MembershipChatRoomAccess(ChatRoomMemberRepository members) {
		this.members = members;
	}

	@Override
	@Transactional(readOnly = true)
	public boolean canSubscribe(long userId, long roomId) {
		return members.findActive(roomId, userId)
				.map(member -> member.getRoom().admitsSubscriber())
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
