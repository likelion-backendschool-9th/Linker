package com.linker.backend.repository.profile;

import java.time.LocalDate;

import com.linker.backend.entity.profile.ProfileVisit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ProfileVisitRepository extends JpaRepository<ProfileVisit, Long> {

	boolean existsByProfileUser_IdAndVisitor_IdAndVisitDate(Long profileUserId, Long visitorId, LocalDate visitDate);

	@Modifying(flushAutomatically = true)
	@Query("delete from ProfileVisit visit where visit.visitDate < :cutoff")
	void deleteByVisitDateBefore(LocalDate cutoff);
}
