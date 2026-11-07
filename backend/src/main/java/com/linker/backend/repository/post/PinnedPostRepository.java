package com.linker.backend.repository.post;

import java.util.List;

import com.linker.backend.entity.post.PinnedPost;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PinnedPostRepository extends JpaRepository<PinnedPost, Long> {

	@Query("""
			select pin.post.id from PinnedPost pin
			where pin.user.id = :userId
			order by pin.sortOrder asc, pin.id asc
			""")
	List<Long> findPostIds(@Param("userId") long userId);

	@Query("""
			select pin.post.id from PinnedPost pin
			where pin.user.id = :userId
			  and pin.post.deletedAt is null
			  and pin.post.visibility = com.linker.backend.entity.post.type.PostVisibility.VISIBLE
			order by pin.sortOrder asc, pin.id asc
			""")
	List<Long> findVisiblePostIds(@Param("userId") long userId);

	@Modifying(flushAutomatically = true)
	@Query("delete from PinnedPost pin where pin.user.id = :userId")
	void deleteByUserId(@Param("userId") long userId);
}
