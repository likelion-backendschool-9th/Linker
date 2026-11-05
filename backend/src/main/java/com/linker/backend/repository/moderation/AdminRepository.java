package com.linker.backend.repository.moderation;

import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.moderation.Admin;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AdminRepository extends JpaRepository<Admin, Long> {

	@Query("select count(a) > 0 from Admin a where a.user.id = :userId")
	boolean existsForUser(@Param("userId") long userId);

	Optional<Admin> findByUser_Id(long userId);

	/** Active admins whose linked account is ACTIVE and not soft-deleted. */
	@Query("""
			select a.user.id from Admin a
			where a.user.status = :status and a.user.deletedAt is null
			""")
	List<Long> findActiveOperatorUserIds(@Param("status") UserStatus status);

	default List<Long> findActiveOperatorUserIds() {
		return findActiveOperatorUserIds(UserStatus.ACTIVE);
	}
}
