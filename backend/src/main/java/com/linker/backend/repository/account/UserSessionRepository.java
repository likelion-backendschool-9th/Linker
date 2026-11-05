package com.linker.backend.repository.account;

import java.time.Instant;
import java.util.Optional;

import com.linker.backend.entity.account.UserSession;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserSessionRepository extends JpaRepository<UserSession, Long> {

	@Query("""
			select s from UserSession s
			join fetch s.user u
			where s.refreshTokenHash = :hash
			  and s.revokedAt is null
			  and s.expiresAt > :now
			""")
	Optional<UserSession> findActive(@Param("hash") String hash, @Param("now") Instant now);

	@Modifying
	@Query("update UserSession s set s.revokedAt = :now where s.user.id = :userId and s.revokedAt is null")
	void revokeActive(@Param("userId") long userId, @Param("now") Instant now);
}
