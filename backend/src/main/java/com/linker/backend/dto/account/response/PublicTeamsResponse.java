package com.linker.backend.dto.account.response;

import java.util.List;

public record PublicTeamsResponse(List<TeamItem> items, String nextCursor) {

	public record TeamItem(long id, String name, String orgAvatarUrl, String status) {
	}
}
