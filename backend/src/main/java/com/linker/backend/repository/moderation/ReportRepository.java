package com.linker.backend.repository.moderation;

import com.linker.backend.entity.moderation.Report;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportRepository extends JpaRepository<Report, Long> {

	boolean existsByReportCase_IdAndReporterId(long caseId, long reporterId);

	long countByReportCase_Id(long caseId);
}
