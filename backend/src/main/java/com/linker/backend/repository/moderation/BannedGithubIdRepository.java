package com.linker.backend.repository.moderation;

import com.linker.backend.entity.moderation.BannedGithubId;

import org.springframework.data.jpa.repository.JpaRepository;

public interface BannedGithubIdRepository extends JpaRepository<BannedGithubId, Long> {

	boolean existsByGithubUserId(String githubUserId);
	@org.springframework.data.jpa.repository.Modifying(flushAutomatically = true)
	@org.springframework.data.jpa.repository.Query("delete from BannedGithubId b where b.sanctionId=:sanctionId")
	int deleteLinkedBan(long sanctionId);
}
