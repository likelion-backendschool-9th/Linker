package com.linker.backend.repository.profile;

import java.util.List;

import com.linker.backend.entity.profile.UserTechTag;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface UserTechTagRepository extends JpaRepository<UserTechTag, Long> {

	@Query("""
			select link from UserTechTag link
			join fetch link.tag
			where link.user.id = :userId
			order by link.id
			""")
	List<UserTechTag> findSelected(Long userId);

	@Modifying
	@Query("delete from UserTechTag link where link.user.id = :userId")
	void deleteByUserId(Long userId);
}
