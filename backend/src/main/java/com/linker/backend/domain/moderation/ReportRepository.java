package com.linker.backend.domain.moderation;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportRepository extends JpaRepository<Report, Long> {

	boolean existsByReportCase_IdAndReporterId(long caseId, long reporterId);

	long countByReportCase_Id(long caseId);
}
