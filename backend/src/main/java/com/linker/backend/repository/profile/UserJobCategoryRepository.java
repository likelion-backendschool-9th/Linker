package com.linker.backend.repository.profile;

import java.util.List;

import com.linker.backend.entity.profile.UserJobCategory;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface UserJobCategoryRepository extends JpaRepository<UserJobCategory, Long> {

	List<UserJobCategory> findByUser_IdOrderByIdAsc(Long userId);

	@Modifying(flushAutomatically = true)
	@Query("delete from UserJobCategory picked where picked.user.id = :userId")
	void deleteByUserId(Long userId);
}
