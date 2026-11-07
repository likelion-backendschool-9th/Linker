package com.linker.backend.repository.moderation;

import java.util.Collection;
import java.util.Optional;

import com.linker.backend.entity.moderation.AdminAction;
import com.linker.backend.entity.moderation.type.AdminActionType;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminActionRepository extends JpaRepository<AdminAction, Long> {

	/** PostgreSQL catalog: refuse external refunds until the agreed migration admits their audit action. */
	@org.springframework.data.jpa.repository.Query(value = """
			select exists(select 1 from pg_constraint c where c.conrelid=to_regclass('admin_actions')
			and c.conname='admin_actions_action_chk' and position('''REFUND''' in pg_get_constraintdef(c.oid))>0)
			""", nativeQuery = true)
	boolean supportsRefundAudit();

	Optional<AdminAction> findFirstByReportCase_IdAndActionInOrderByIdDesc(long caseId, Collection<AdminActionType> actions);
}
