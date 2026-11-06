package com.linker.backend.service.user;

import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.TeamAccess;
import com.linker.backend.global.security.TeamRole;
import org.springframework.stereotype.Service;

/** Same-access-group permission use case shared by issue reads and edits. */
@Service
public class UserIssueAccess {
  private final TeamAccess teams;

  public UserIssueAccess(TeamAccess teams) {
    this.teams = teams;
  }

  public void member(AuthenticatedUser user, long team) {
    if (user == null) throw new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요");
    if (team <= 0) throw new ApiException(400, "VALIDATION_ERROR", "팀을 확인해 주세요");
    if (user.userType() != UserType.DEVELOPER)
      throw new ApiException(403, "DEVELOPER_ONLY", "개발자만 사용할 수 있어요");
    if (user.status() == UserStatus.DELETED || user.status() == UserStatus.WITHDRAWING)
      throw new ApiException(403, "FORBIDDEN", "이 계정으로는 조회할 수 없어요");
    if (!teams.hasRole(user.userId(), team, TeamRole.Level.MEMBER))
      throw new ApiException(403, "TEAM_ROLE_REQUIRED", "팀 권한이 필요해요");
  }
}
