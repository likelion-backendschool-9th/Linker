package com.linker.backend.repository.github;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.github.GithubWebhookDelivery;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GithubWebhookDeliveryRepository extends JpaRepository<GithubWebhookDelivery, Long>, GithubWebhookDeliveryRepositoryCustom {

	Optional<GithubWebhookDelivery> findByDeliveryId(String deliveryId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select d from GithubWebhookDelivery d where d.id = :id")
	Optional<GithubWebhookDelivery> findByIdForUpdate(@Param("id") long id);

	@Query(value = """
			select id from github_webhook_deliveries
			where (status = 'RECEIVED' and updated_at <= :receivedBefore)
			   or (status = 'FAILED' and attempts < :maxAttempts and updated_at <= :retryBefore)
			order by updated_at, id limit :batchSize
			""", nativeQuery = true)
	List<Long> findRecoveryIds(Instant receivedBefore, Instant retryBefore, int maxAttempts, int batchSize);

	@Modifying
	@Query(value = """
			update github_webhook_deliveries set updated_at = :now
			where id = :id and ((status = 'RECEIVED' and updated_at <= :receivedBefore)
			or (status = 'FAILED' and attempts < :maxAttempts and updated_at <= :retryBefore))
			""", nativeQuery = true)
	int touchForRecovery(long id, Instant now, Instant receivedBefore, Instant retryBefore, int maxAttempts);
}
