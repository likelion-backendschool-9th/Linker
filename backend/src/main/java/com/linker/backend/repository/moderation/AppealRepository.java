package com.linker.backend.repository.moderation;

import java.util.List;

import com.linker.backend.entity.moderation.Appeal;
import com.linker.backend.entity.moderation.AppealStatus;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AppealRepository extends JpaRepository<Appeal, Long> {

	List<Appeal> findByStatusOrderByIdDesc(AppealStatus status);

	@Query("""
			select a.sanction.reportCase.id from Appeal a
			where a.status = com.linker.backend.entity.moderation.AppealStatus.PENDING
			  and a.sanction.reportCase is not null
			""")
	List<Long> findPendingCaseIds();
}
