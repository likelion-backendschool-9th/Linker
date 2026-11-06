package com.linker.backend.controller.user;

import com.linker.backend.dto.team.request.CompleteTeamSetupRequest;
import com.linker.backend.dto.team.request.CreateTeamRequest;
import com.linker.backend.dto.team.request.SaveTeamReposRequest;
import com.linker.backend.dto.team.request.SetupBoardRequest;
import com.linker.backend.dto.team.response.MyTeamsResponse;
import com.linker.backend.dto.team.response.TeamSetupResponse;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.DeveloperOnly;
import com.linker.backend.global.security.TeamRole;
import com.linker.backend.service.user.TeamService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController("userTeamController")
@RequestMapping("/user")
public class TeamController {
  private final TeamService teams;

  public TeamController(TeamService teams) {
    this.teams = teams;
  }

  @GetMapping("/me/teams")
  @DeveloperOnly
  @Tag(name = "p07-workspace")
  @Operation(operationId = "getMyTeams", summary = "현재 참여 중인 본인의 팀 목록")
  public ResponseEntity<MyTeamsResponse> myTeams(@AuthenticationPrincipal AuthenticatedUser user) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(teams.myTeams(user));
  }

  @PostMapping("/teams")
  @DeveloperOnly
  @Tag(name = "p08-team-create")
  @Operation(operationId = "createTeam")
  public ResponseEntity<TeamSetupResponse.Created> create(
      @AuthenticationPrincipal AuthenticatedUser user,
      @Valid @RequestBody CreateTeamRequest request) {
    return ResponseEntity.status(201)
        .cacheControl(CacheControl.noStore())
        .body(teams.create(user, request));
  }

  @GetMapping("/teams/{teamId}/setup/repos")
  @DeveloperOnly
  @TeamRole(TeamRole.Level.OWNER)
  @Tag(name = "p08-team-create")
  @Operation(operationId = "listSetupRepositories")
  public ResponseEntity<TeamSetupResponse.Repos> repos(
      @AuthenticationPrincipal AuthenticatedUser user, @PathVariable long teamId) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(teams.setupRepos(user, teamId));
  }

  @PutMapping("/teams/{teamId}/setup/repos")
  @DeveloperOnly
  @TeamRole(TeamRole.Level.OWNER)
  @Tag(name = "p08-team-create")
  @Operation(operationId = "saveSetupRepositories")
  public ResponseEntity<Void> repos(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable long teamId,
      @Valid @RequestBody SaveTeamReposRequest request) {
    teams.saveSetupRepos(user, teamId, request);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/teams/{teamId}/setup/boards")
  @DeveloperOnly
  @TeamRole(TeamRole.Level.ADMIN)
  @Tag(name = "p08-team-create")
  @Operation(operationId = "listSetupBoards")
  public ResponseEntity<TeamSetupResponse.Boards> boards(
      @AuthenticationPrincipal AuthenticatedUser user, @PathVariable long teamId) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(teams.setupBoards(user, teamId));
  }

  @PostMapping("/teams/{teamId}/setup/board")
  @DeveloperOnly
  @TeamRole(TeamRole.Level.ADMIN)
  @Tag(name = "p08-team-create")
  @Operation(operationId = "saveSetupBoard")
  public ResponseEntity<TeamSetupResponse.BoardSaved> board(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable long teamId,
      @Valid @RequestBody SetupBoardRequest request) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(teams.saveSetupBoard(user, teamId, request));
  }

  @GetMapping("/teams/{teamId}/setup/permission-check")
  @DeveloperOnly
  @TeamRole(TeamRole.Level.OWNER)
  @Tag(name = "p08-team-create")
  @Operation(operationId = "checkSetupPermission")
  public ResponseEntity<TeamSetupResponse.Permission> permission(
      @AuthenticationPrincipal AuthenticatedUser user, @PathVariable long teamId) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(teams.setupPermission(user, teamId));
  }

  @PostMapping("/teams/{teamId}/setup/complete")
  @DeveloperOnly
  @TeamRole(TeamRole.Level.OWNER)
  @Tag(name = "p08-team-create")
  @Operation(operationId = "completeTeamSetup")
  public ResponseEntity<TeamSetupResponse.Complete> complete(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable long teamId,
      @RequestBody(required = false) CompleteTeamSetupRequest request) {
    return ResponseEntity.accepted()
        .cacheControl(CacheControl.noStore())
        .body(teams.completeSetup(user, teamId, request != null && request.retry()));
  }
}
