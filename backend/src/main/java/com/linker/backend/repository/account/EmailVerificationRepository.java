package com.linker.backend.repository.account;

import java.time.Instant;
import java.util.Optional;

import com.linker.backend.entity.account.EmailVerification;
import com.linker.backend.entity.account.type.VerificationPurpose;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmailVerificationRepository extends JpaRepository<EmailVerification, Long> {

	Optional<EmailVerification> findFirstByEmailAndPurposeAndUsedAtIsNullOrderByIdDesc(String email, VerificationPurpose purpose);

	Optional<EmailVerification> findFirstByPurposeAndCodeHashAndUsedAtIsNull(VerificationPurpose purpose, String codeHash);

	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query("""
			update EmailVerification row
			set row.usedAt = :now
			where row.email = :email and row.purpose = :purpose and row.usedAt is null
			""")
	void invalidateUnused(
			@Param("email") String email,
			@Param("purpose") VerificationPurpose purpose,
			@Param("now") Instant now);
}
