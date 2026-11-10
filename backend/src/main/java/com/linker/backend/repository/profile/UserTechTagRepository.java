package com.linker.backend.repository.profile;

import java.util.Collection;
import java.util.List;

import com.linker.backend.entity.profile.UserTechTag;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserTechTagRepository extends JpaRepository<UserTechTag, Long> {

	@Query("""
			select link from UserTechTag link
			join fetch link.tag
			where link.user.id = :userId
			order by link.id
			""")
	List<UserTechTag> findSelected(Long userId);

	/**
	 * 24 empty feed (Policy ch. 4 exceptions): active developers who picked any of these tags, the most
	 * shared tags first. The caller drops people it must not suggest (followed, blocked).
	 */
	@Query("""
			select link.user.id from UserTechTag link
			where link.tag.name in :tagNames
			  and link.user.id <> :userId
			  and link.user.userType = com.linker.backend.entity.account.type.UserType.DEVELOPER
			  and link.user.status = com.linker.backend.entity.account.type.UserStatus.ACTIVE
			  and link.user.deletedAt is null
			group by link.user.id
			order by count(link) desc, link.user.id asc
			""")
	List<Long> findDevelopersSharingTags(
			@Param("userId") long userId,
			@Param("tagNames") Collection<String> tagNames);

	/** Each person's tech stack in their own order: rows of (user id, tag name) */
	@Query("""
			select link.user.id, link.tag.name from UserTechTag link
			where link.user.id in :userIds
			order by link.id
			""")
	List<Object[]> findTagNamesByUserIds(@Param("userIds") Collection<Long> userIds);

	@Modifying
	@Query("delete from UserTechTag link where link.user.id = :userId")
	void deleteByUserId(Long userId);
}
