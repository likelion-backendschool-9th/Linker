package com.linker.backend.domain.moderation;

import java.util.Optional;

import com.linker.backend.domain.account.UserRepository;
import com.linker.backend.domain.account.UserStatus;

import org.springframework.stereotype.Component;

@Component
public class UserReportTargetResolver implements ReportTargetResolver {

	private final UserRepository users;

	public UserReportTargetResolver(UserRepository users) {
		this.users = users;
	}

	@Override
	public ReportTargetType supports() {
		return ReportTargetType.USER;
	}

	@Override
	public Optional<ResolvedTarget> resolve(long targetId) {
		return users.findById(targetId)
				.filter(user -> user.getStatus() != UserStatus.DELETED && user.getDeletedAt() == null)
				.map(user -> new ResolvedTarget(user.getId()));
	}
}
