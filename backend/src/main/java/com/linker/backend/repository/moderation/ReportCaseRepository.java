package com.linker.backend.repository.moderation;

import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.moderation.ReportCase;
import com.linker.backend.entity.moderation.type.ReportCaseStatus;
import com.linker.backend.entity.moderation.type.ReportTargetType;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReportCaseRepository extends JpaRepository<ReportCase, Long> {

	Optional<ReportCase> findByTargetTypeAndTargetIdAndStatus(ReportTargetType targetType, long targetId, ReportCaseStatus status);

	List<ReportCase> findByTargetType(ReportTargetType targetType);
	List<ReportCase> findByTargetUserIdOrderByIdDesc(long userId, org.springframework.data.domain.Pageable page);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select c from ReportCase c where c.id = :id")
	Optional<ReportCase> lockById(@Param("id") long id);
}
