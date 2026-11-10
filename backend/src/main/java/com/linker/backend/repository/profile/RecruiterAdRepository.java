package com.linker.backend.repository.profile;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.profile.type.AdStatus;
import com.linker.backend.entity.profile.RecruiterAd;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RecruiterAdRepository extends JpaRepository<RecruiterAd, Long> {

	Optional<RecruiterAd> findByRecruiter_Id(Long recruiterId);

	List<RecruiterAd> findByStatusInAndClosesOnBefore(Collection<AdStatus> statuses, LocalDate day);

	// Report hide, delete, or restore. A bulk update leaves updatedAt and endedReason unchanged.
	@Modifying(flushAutomatically = true)
	@Query("""
			update RecruiterAd a
			set a.status = :status, a.hiddenAt = :hiddenAt, a.deletedAt = :deletedAt
			where a.id = :id
			""")
	int updateReportedState(
			@Param("id") long id,
			@Param("status") AdStatus status,
			@Param("hiddenAt") Instant hiddenAt,
			@Param("deletedAt") Instant deletedAt);
}
