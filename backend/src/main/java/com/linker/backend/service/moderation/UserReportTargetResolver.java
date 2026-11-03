package com.linker.backend.service.moderation;

import java.util.Optional;

import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.moderation.ReportTargetType;
import com.linker.backend.repository.account.UserRepository;

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
