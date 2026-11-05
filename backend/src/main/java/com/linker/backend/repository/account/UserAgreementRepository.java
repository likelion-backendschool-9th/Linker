package com.linker.backend.repository.account;

import java.util.Optional;

import com.linker.backend.entity.account.AgreementType;
import com.linker.backend.entity.account.UserAgreement;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserAgreementRepository extends JpaRepository<UserAgreement, Long> {

	Optional<UserAgreement> findByUser_IdAndAgreementTypeAndVersion(Long userId, AgreementType agreementType, String version);

	boolean existsByUser_IdAndAgreementTypeAndVersionAndWithdrawnAtIsNull(
			Long userId, AgreementType agreementType, String version);
}
