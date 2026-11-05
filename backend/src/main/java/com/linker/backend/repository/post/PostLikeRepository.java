package com.linker.backend.repository.post;

import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.post.PostLike;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PostLikeRepository extends JpaRepository<PostLike, Long> {

	boolean existsByPostIdAndUserId(long postId, long userId);

	Optional<PostLike> findByPostIdAndUserId(long postId, long userId);

	void deleteByPostId(long postId);

	@Query("""
			select l from PostLike l
			join fetch l.user
			where l.post.id = :postId
			  and (:cursorId is null or l.id < :cursorId)
			order by l.id desc
			""")
	List<PostLike> findLikers(
			@Param("postId") long postId,
			@Param("cursorId") Long cursorId,
			Pageable pageable
	);
}
