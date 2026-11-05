package com.linker.backend.repository.moderation;

import java.util.List;

import com.linker.backend.entity.moderation.Report;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReportRepository extends JpaRepository<Report, Long> {

	boolean existsByReportCase_IdAndReporterId(long caseId, long reporterId);

	long countByReportCase_Id(long caseId);

	@Query("select r.reporterId from Report r where r.reportCase.id = :caseId")
	List<Long> findReporterIdsByReportCaseId(@Param("caseId") long caseId);
}
