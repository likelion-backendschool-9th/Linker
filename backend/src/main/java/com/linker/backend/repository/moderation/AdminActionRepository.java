package com.linker.backend.repository.moderation;

import java.util.Collection;
import java.util.Optional;

import com.linker.backend.entity.moderation.AdminAction;
import com.linker.backend.entity.moderation.type.AdminActionType;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminActionRepository extends JpaRepository<AdminAction, Long> {

	Optional<AdminAction> findFirstByReportCase_IdAndActionInOrderByIdDesc(long caseId, Collection<AdminActionType> actions);
}
