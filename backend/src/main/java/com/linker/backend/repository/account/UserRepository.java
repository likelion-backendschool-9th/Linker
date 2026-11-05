package com.linker.backend.repository.account;

import java.time.Instant;
import java.util.List;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository extends JpaRepository<User, Long> {

	@Query("""
			select u from User u
			where u.userType = com.linker.backend.entity.account.UserType.DEVELOPER
			  and u.status = com.linker.backend.entity.account.UserStatus.ACTIVE
			  and u.deletedAt is null
			""")
	List<User> findIndexable(Pageable pageable);
}
