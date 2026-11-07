package com.linker.backend.repository.subscription;

import java.util.Optional;

import com.linker.backend.entity.subscription.Payment;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

	Optional<Payment> findByOrderId(String orderId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select p from Payment p where p.orderId = :orderId")
	Optional<Payment> lockByOrderId(String orderId);
}
