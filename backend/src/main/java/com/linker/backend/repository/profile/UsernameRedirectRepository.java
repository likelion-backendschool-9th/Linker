package com.linker.backend.repository.profile;

import java.util.Optional;

import com.linker.backend.entity.profile.UsernameRedirect;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface UsernameRedirectRepository extends JpaRepository<UsernameRedirect, Long> {

	Optional<UsernameRedirect> findByOldUsername(String oldUsername);

	@Modifying(flushAutomatically = true)
	@Query("delete from UsernameRedirect redirect where redirect.oldUsername = :oldUsername")
	void deleteByOldUsername(String oldUsername);
}
