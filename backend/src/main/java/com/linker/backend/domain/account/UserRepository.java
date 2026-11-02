package com.linker.backend.domain.account;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository extends JpaRepository<User, Long> {

	@Query("""
			select u from User u
			where u.userType = com.linker.backend.domain.account.UserType.DEVELOPER
			  and u.status = com.linker.backend.domain.account.UserStatus.ACTIVE
			  and u.deletedAt is null
			""")
	List<User> findIndexable(Pageable pageable);
}
