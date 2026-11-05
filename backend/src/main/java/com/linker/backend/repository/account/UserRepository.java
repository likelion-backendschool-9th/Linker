package com.linker.backend.repository.account;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserStatus;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository extends JpaRepository<User, Long> {

	Optional<User> findByUsername(String username);

	List<User> findByStatusAndWithdrawRequestedAtLessThanEqual(UserStatus status, Instant withdrawRequestedAt);

	@Query("""
			select u from User u
			where u.userType = com.linker.backend.entity.account.UserType.DEVELOPER
			  and u.deletedAt is null
			  and u.status <> com.linker.backend.entity.account.UserStatus.DELETED
			  and coalesce(u.lastActiveAt, u.createdAt) <= :inactiveSince
			  and (u.lookingForTeam = true
			       or u.jobSeekingStatus <> com.linker.backend.entity.account.JobSeekingStatus.OFF)
			""")
	List<User> findInactiveDevelopers(Instant inactiveSince);

	@Query("""
			select u from User u
			where u.userType = com.linker.backend.entity.account.UserType.DEVELOPER
			  and u.status = com.linker.backend.entity.account.UserStatus.ACTIVE
			  and u.deletedAt is null
			""")
	List<User> findIndexable(Pageable pageable);

	boolean existsByUsername(String username);

	boolean existsByUsernameAndIdNot(String username, Long id);
}
