package com.linker.backend.repository.subscription;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.subscription.Payment;
import com.linker.backend.entity.subscription.type.PaymentStatus;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

	Optional<Payment> findByOrderId(String orderId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select p from Payment p where p.orderId = :orderId")
	Optional<Payment> lockByOrderId(String orderId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select p from Payment p where p.id = :id")
	Optional<Payment> lockById(long id);

	/** Payment history, newest order first; {@code cursor} is the last id of the previous page. */
	@Query("""
			select p from Payment p
			where p.payerUserId = :payerUserId and p.status in :statuses
			  and (:cursor is null or p.id < :cursor)
			order by p.id desc
			""")
	List<Payment> findHistory(long payerUserId, Collection<PaymentStatus> statuses, Long cursor, Pageable page);

	/** Paid orders of one subscription, last approved first: the first one paid the current period. */
	@Query("""
			select p from Payment p
			where p.subscriptionId = :subscriptionId and p.status = :status
			order by p.approvedAt desc, p.id desc
			""")
	List<Payment> findPaidNewestFirst(long subscriptionId, PaymentStatus status, Pageable page);
}
