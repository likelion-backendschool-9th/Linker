package com.linker.backend.repository.moderation;

import java.time.Instant;
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

	List<Report> findByReportCase_Id(long caseId);

	@Query("""
			select count(r) from Report r
			where r.reportCase.id = :caseId
			  and not exists (
			    select s.id from Sanction s
			    where s.user.id = r.reporterId
			      and s.sanctionType = com.linker.backend.entity.moderation.SanctionType.REPORT_RESTRICTION
			      and s.revokedAt is null
			      and (s.endsAt is null or s.endsAt > :now)
			  )
			""")
	long countEligibleReporters(@Param("caseId") long caseId, @Param("now") Instant now);

	@Query("""
			select count(r) from Report r
			where r.reporterId = :reporterId
			  and r.reportCase.status = com.linker.backend.entity.moderation.ReportCaseStatus.DISMISSED
			  and r.reportCase.resolvedAt >= :since
			""")
	long countDismissedSince(@Param("reporterId") long reporterId, @Param("since") Instant since);
}
