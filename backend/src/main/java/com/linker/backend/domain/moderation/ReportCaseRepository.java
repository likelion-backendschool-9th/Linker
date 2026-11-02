package com.linker.backend.domain.moderation;

import java.util.Optional;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReportCaseRepository extends JpaRepository<ReportCase, Long> {

	Optional<ReportCase> findByTargetTypeAndTargetIdAndStatus(ReportTargetType targetType, long targetId, ReportCaseStatus status);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select c from ReportCase c where c.id = :id")
	Optional<ReportCase> lockById(@Param("id") long id);
}
