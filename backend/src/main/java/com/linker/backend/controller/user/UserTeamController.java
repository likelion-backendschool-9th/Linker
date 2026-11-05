package com.linker.backend.controller.user;

import com.linker.backend.dto.team.response.MyTeamsResponse;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.DeveloperOnly;
import com.linker.backend.service.user.UserTeamService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/user")
public class UserTeamController {
	private final UserTeamService teams;

	public UserTeamController(UserTeamService teams) {
		this.teams = teams;
	}

	@GetMapping("/me/teams")
	@DeveloperOnly
	@Tag(name = "p07-workspace")
	@Operation(operationId = "getMyTeams", summary = "현재 참여 중인 본인의 팀 목록")
	public ResponseEntity<MyTeamsResponse> myTeams(@AuthenticationPrincipal AuthenticatedUser user) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(teams.myTeams(user));
	}
}
