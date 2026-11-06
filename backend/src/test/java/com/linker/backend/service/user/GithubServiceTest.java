package com.linker.backend.service.user;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.linker.backend.dto.github.request.VerifyInstallationRequest;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.global.config.GithubAppProperties;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.github.*;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class GithubServiceTest {
  private final GithubInstallationState states = mock(GithubInstallationState.class);
  private final GithubUserAccessTokenSource tokens = mock(GithubUserAccessTokenSource.class);
  private final GithubAppClient client = mock(GithubAppClient.class);
  private final GithubService service =
      new GithubService(
          GithubAppProperties.installation(
              "123",
              "linker-test",
              "",
              "https://api.github.com",
              "2026-03-10",
              Duration.ofSeconds(10),
              Duration.ofMinutes(10)),
          states,
          tokens,
          client,
          mock(GithubTeamSource.class),
          mock(com.linker.backend.repository.team.TeamSetupRepository.class));

  @Test
  void missingUserTokenIntegrationNeverBecomesASuccess() {
    when(tokens.tokenFor(7)).thenThrow(new ApiException(503, "SERVICE_UNAVAILABLE", "연결이 필요해요"));
    assertThatThrownBy(
            () ->
                service.verify(
                    user(UserType.DEVELOPER, UserStatus.ACTIVE),
                    new VerifyInstallationRequest("42", "state", "install")))
        .isInstanceOfSatisfying(
            ApiException.class, exception -> assertThat(exception.getStatus()).isEqualTo(503));
    verifyNoInteractions(client);
  }

  @Test
  void suspendedOrRecruiterAccountsCannotIssueInstallationState() {
    assertThatThrownBy(() -> service.installUrl(user(UserType.RECRUITER, UserStatus.ACTIVE)))
        .isInstanceOf(ApiException.class);
    assertThatThrownBy(() -> service.installUrl(user(UserType.DEVELOPER, UserStatus.SUSPENDED)))
        .isInstanceOf(ApiException.class);
    assertThatThrownBy(() -> service.installUrl(null)).isInstanceOf(ApiException.class);
    verifyNoInteractions(states, tokens, client);
  }

  @Test
  void stateMustBeValidBeforeAnyTokenOrGithubLookup() {
    doThrow(new ApiException(400, "VALIDATION_ERROR", "state 만료"))
        .when(states)
        .consume("expired", 7, 11);
    assertThatThrownBy(
            () ->
                service.verify(
                    user(UserType.DEVELOPER, UserStatus.ACTIVE),
                    new VerifyInstallationRequest("42", "expired", "install")))
        .isInstanceOf(ApiException.class);
    verifyNoInteractions(tokens, client);
  }

  private AuthenticatedUser user(UserType type, UserStatus status) {
    return new AuthenticatedUser(7, "user", type, status, null, false, false, true, 11);
  }
}
