package com.linker.backend.domain.github;

import java.util.Optional;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GithubWebhookDeliveryRepository extends JpaRepository<GithubWebhookDelivery, Long> {

	Optional<GithubWebhookDelivery> findByDeliveryId(String deliveryId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select d from GithubWebhookDelivery d where d.id = :id")
	Optional<GithubWebhookDelivery> findByIdForUpdate(@Param("id") long id);
}
