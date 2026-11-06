package com.linker.backend.repository.profile;

import java.time.LocalDate;
import java.util.List;

import com.linker.backend.entity.profile.ContributionDay;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ContributionDayRepository extends JpaRepository<ContributionDay, Long> {

	List<ContributionDay> findByUser_IdAndDayBetweenOrderByDayAsc(Long userId, LocalDate start, LocalDate end);

	@Modifying(flushAutomatically = true)
	@Query("delete from ContributionDay day where day.user.id = :userId")
	void deleteByUserId(Long userId);
}
