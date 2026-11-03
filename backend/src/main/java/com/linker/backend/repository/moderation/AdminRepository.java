package com.linker.backend.repository.moderation;

import com.linker.backend.entity.moderation.Admin;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AdminRepository extends JpaRepository<Admin, Long> {

	@Query("select count(a) > 0 from Admin a where a.user.id = :userId")
	boolean existsForUser(@Param("userId") long userId);
}
