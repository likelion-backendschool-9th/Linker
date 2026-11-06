package com.linker.backend.repository.team;

import com.linker.backend.dto.team.response.TeamConnectionView;
import com.linker.backend.dto.team.response.TeamConnectionView.LinkedRepo;
import com.linker.backend.dto.team.response.TeamConnectionView.StatusMapping;
import com.linker.backend.service.user.OwnedTeamLookup;
import java.util.List;
import java.util.Optional;

public interface TeamRepositoryCustom {
  List<OwnedTeamLookup.OwnedTeam> findOwnedTeams(long userId);
  /** installationId is the external GitHub installation ID, not github_installations.id. */
  Optional<TeamConnectionView> findConnection(long teamId);
  List<LinkedRepo> findLinkedRepos(long teamId);
  List<StatusMapping> findBoardStatusMappings(long boardId);
}
