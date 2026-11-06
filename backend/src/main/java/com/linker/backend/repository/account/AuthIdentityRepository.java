package com.linker.backend.repository.account;

import java.util.Optional;

import com.linker.backend.entity.account.AuthIdentity;
import com.linker.backend.entity.account.AuthProvider;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuthIdentityRepository extends JpaRepository<AuthIdentity, Long> {

	@Query("""
			select identity from AuthIdentity identity
			join fetch identity.user
			where identity.provider = :provider
			  and identity.providerUserId = :providerUserId
			""")
	Optional<AuthIdentity> findByProviderAndProviderUserId(
			@Param("provider") AuthProvider provider,
			@Param("providerUserId") String providerUserId);

	@Query("""
			select identity from AuthIdentity identity
			join fetch identity.user
			where identity.user.id = :userId
			  and identity.provider = :provider
			""")
	Optional<AuthIdentity> findByUserIdAndProvider(
			@Param("userId") long userId,
			@Param("provider") AuthProvider provider);
}
