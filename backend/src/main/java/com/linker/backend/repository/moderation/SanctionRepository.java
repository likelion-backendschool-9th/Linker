package com.linker.backend.repository.moderation;

import java.time.Instant;

import com.linker.backend.entity.moderation.Sanction;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SanctionRepository extends JpaRepository<Sanction, Long> {

	java.util.List<Sanction> findByUser_IdOrderByIdDesc(long userId);

	@Query("""
			select count(s) > 0 from Sanction s
			where s.user.id = :userId
			  and s.sanctionType = com.linker.backend.entity.moderation.type.SanctionType.REPORT_RESTRICTION
			  and s.revokedAt is null
			  and (s.endsAt is null or s.endsAt > :now)
			""")
	boolean hasActiveReportRestriction(@Param("userId") long userId, @Param("now") Instant now);
}
