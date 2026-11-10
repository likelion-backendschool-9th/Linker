package com.linker.backend.controller;

import com.linker.backend.dto.team.response.TeamInviteResponse.Landing;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.service.TeamService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/public")
public class TeamController {
  private final TeamService teams;

  public TeamController(TeamService teams) {
    this.teams = teams;
  }

  @GetMapping("/invites/{code}")
  @Tag(name = "p10-invite")
  @Operation(operationId = "getTeamInvite")
  public ResponseEntity<Landing> invite(
      @PathVariable String code, @AuthenticationPrincipal AuthenticatedUser viewer) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(teams.invite(code, viewer));
  }
}
