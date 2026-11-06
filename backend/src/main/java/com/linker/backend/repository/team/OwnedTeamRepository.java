package com.linker.backend.repository.team;

import com.linker.backend.service.user.OwnedTeamLookup;
import java.util.List;
import org.springframework.stereotype.Repository;

/** Retains A's existing withdrawal contract while Spring Data owns the actual JPQL query. */
@Repository
public class OwnedTeamRepository implements OwnedTeamLookup {
  private final TeamRepository teams;

  public OwnedTeamRepository(TeamRepository teams) {
    this.teams = teams;
  }

  @Override
  public List<OwnedTeam> ownedBy(long userId) {
    return teams.findOwnedTeams(userId);
  }
}
