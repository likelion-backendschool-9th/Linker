package com.linker.backend.dto.account.response;

import java.util.List;

public record ProfilePeopleResponse(List<Person> items, String nextCursor) {

	public record Person(Card user, boolean isFollowing) {
	}

	public record Card(
			long id,
			String login,
			String name,
			String avatarUrl,
			String userType,
			String jobStatus
	) {
	}
}
