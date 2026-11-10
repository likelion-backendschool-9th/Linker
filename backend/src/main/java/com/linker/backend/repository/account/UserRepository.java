package com.linker.backend.repository.account;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserStatus;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository extends JpaRepository<User, Long>, UserRepositoryCustom {

	/** Serialize share-card retries across rooms for the same sender/clientMessageId. */
	@org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
	@Query("select u from User u where u.id = :userId and u.status = 'ACTIVE' and u.deletedAt is null")
	Optional<User> lockActiveAccount(long userId);

	/** Serialize team creates for one account, including requests for different organizations. */
	@org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
	@Query("""
			select u from User u where u.id = :userId and u.userType = 'DEVELOPER'
			  and u.status = 'ACTIVE' and u.deletedAt is null
			""")
	Optional<User> lockActiveDeveloper(long userId);

	Optional<User> findByUsername(String username);

	List<User> findByStatusAndWithdrawRequestedAtLessThanEqual(UserStatus status, Instant withdrawRequestedAt);

	@Query("""
			select u from User u
			where u.userType = com.linker.backend.entity.account.type.UserType.DEVELOPER
			  and u.deletedAt is null
			  and u.status <> com.linker.backend.entity.account.type.UserStatus.DELETED
			  and coalesce(u.lastActiveAt, u.createdAt) <= :inactiveSince
			  and (u.lookingForTeam = true
			       or u.jobSeekingStatus <> com.linker.backend.entity.account.type.JobSeekingStatus.OFF)
			""")
	List<User> findInactiveDevelopers(Instant inactiveSince);

	@Query("""
			select u from User u
			where u.userType = com.linker.backend.entity.account.type.UserType.DEVELOPER
			  and u.status = com.linker.backend.entity.account.type.UserStatus.ACTIVE
			  and u.deletedAt is null
			""")
	List<User> findIndexable(Pageable pageable);

	boolean existsByUsername(String username);

	boolean existsByUsernameAndIdNot(String username, Long id);

	@org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
	@Query("select u from User u where u.id=:userId")
	Optional<User> lockById(long userId);

	@Query("""
			select u from User u where (lower(u.username) like :pattern escape '!'
			  or lower(u.displayName) like :pattern escape '!')
			  and (:status is null or u.status=:status) and (:type is null or u.userType=:type)
			  and (:cursor is null or u.id<:cursor) order by u.id desc
			""")
	List<User> findAdministrationPage(String pattern, UserStatus status,
			com.linker.backend.entity.account.type.UserType type, Long cursor, Pageable page);

	@Query("select u.id from User u where u.status='SUSPENDED' and u.suspendedUntil<=:now order by u.id")
	List<Long> findExpiredSuspensionIds(Instant now, Pageable page);
}
