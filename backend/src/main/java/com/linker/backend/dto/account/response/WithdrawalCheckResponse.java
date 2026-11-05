package com.linker.backend.dto.account.response;

import java.util.List;

public record WithdrawalCheckResponse(List<OwnedTeamResponse> ownedTeams) {

	public record OwnedTeamResponse(long id, String name) {
	}
}
