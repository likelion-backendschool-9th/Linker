package com.linker.backend.repository.moderation;

import java.util.List;

import com.linker.backend.entity.moderation.ReportMessageSnapshot;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportMessageSnapshotRepository extends JpaRepository<ReportMessageSnapshot, Long> {

	List<ReportMessageSnapshot> findByReport_ReportCase_IdOrderByRelPositionAsc(long caseId);

	boolean existsByReport_ReportCase_Id(long caseId);
}
