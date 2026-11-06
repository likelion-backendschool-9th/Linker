package com.linker.backend.repository.profile;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.profile.type.AdStatus;
import com.linker.backend.entity.profile.RecruiterAd;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RecruiterAdRepository extends JpaRepository<RecruiterAd, Long> {

	Optional<RecruiterAd> findByRecruiter_Id(Long recruiterId);

	List<RecruiterAd> findByStatusInAndClosesOnBefore(Collection<AdStatus> statuses, LocalDate day);
}
