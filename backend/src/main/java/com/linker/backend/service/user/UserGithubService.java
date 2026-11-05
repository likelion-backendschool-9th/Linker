package com.linker.backend.service.user;

import com.linker.backend.dto.github.request.VerifyInstallationRequest;
import com.linker.backend.dto.github.response.GithubInstallationView;
import com.linker.backend.dto.github.response.InstallUrlResponse;
import com.linker.backend.dto.github.response.VerifyInstallationResponse;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.global.config.GithubAppProperties;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.github.GithubAppClient;
import com.linker.backend.integration.github.GithubInstallationState;
import com.linker.backend.integration.github.GithubUserAccessTokenSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Installation SPIKE; team creation/linking is a separate page-08 use case. */
@Service
public class UserGithubService {
	private final GithubAppProperties properties;
	private final GithubInstallationState states;
	private final GithubUserAccessTokenSource tokens;
	private final GithubAppClient github;

	public UserGithubService(GithubAppProperties properties, GithubInstallationState states,
			GithubUserAccessTokenSource tokens, GithubAppClient github) {
		this.properties = properties;
		this.states = states;
		this.tokens = tokens;
		this.github = github;
	}

	@Transactional(propagation = Propagation.NEVER)
	public InstallUrlResponse installUrl(AuthenticatedUser user) {
		requireDeveloper(user);
		if (properties.id().isBlank() || !properties.slug().matches("[a-zA-Z0-9-]+")) {
			throw new ApiException(503, "SERVICE_UNAVAILABLE", "GitHub App 설정이 필요해요");
		}
		String state = states.issue(user.userId(), user.sessionId());
		return new InstallUrlResponse("https://github.com/apps/" + properties.slug() + "/installations/new?state=" + state, state);
	}

	@Transactional(propagation = Propagation.NEVER)
	public VerifyInstallationResponse verify(AuthenticatedUser user, VerifyInstallationRequest request) {
		requireDeveloper(user);
		long id;
		try {
			id = Long.parseLong(request.installationId());
			if (id <= 0) { throw new NumberFormatException(); }
		}
		catch (NumberFormatException exception) {
			throw new ApiException(400, "VALIDATION_ERROR", "설치 정보를 확인해 주세요");
		}
		states.consume(request.state(), user.userId(), user.sessionId());
		GithubInstallationView verified = github.verifyUserInstallation(tokens.tokenFor(user.userId()), id);
		return new VerifyInstallationResponse("INSTALLED", new VerifyInstallationResponse.Organization(
				verified.orgId(), verified.login(), verified.avatarUrl()), Long.toString(verified.installationId()));
	}

	private void requireDeveloper(AuthenticatedUser user) {
		if (user == null) { throw new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요"); }
		if (user.userType() != UserType.DEVELOPER || user.status() != UserStatus.ACTIVE) {
			throw new ApiException(403, "FORBIDDEN", "이 기능을 사용할 수 없어요");
		}
	}
}
