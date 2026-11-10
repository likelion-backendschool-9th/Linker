package com.linker.backend.global.security;

import java.util.Map;

import com.linker.backend.global.error.ApiException;

import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.servlet.HandlerMapping;

@Aspect
@Component
public class TeamRoleAspect {

	private final TeamAccess teamAccess;

	public TeamRoleAspect(TeamAccess teamAccess) {
		this.teamAccess = teamAccess;
	}

	@Before("@annotation(teamRole)")
	public void check(TeamRole teamRole) {
		AuthenticatedUser user = CurrentUser.require();
		long teamId = teamId();
		if (!teamAccess.hasRole(user.userId(), teamId, teamRole.value())) {
			throw new ApiException(403, "TEAM_ROLE_REQUIRED", "팀 권한이 필요해요");
		}
	}

	private long teamId() {
		ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
		if (attributes == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		}
		HttpServletRequest request = attributes.getRequest();
		Object value = request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
		if (!(value instanceof Map<?, ?> variables) || variables.get("teamId") == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		}
		try {
			return Long.parseLong(variables.get("teamId").toString());
		}
		catch (NumberFormatException exception) {
			throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		}
	}
}
