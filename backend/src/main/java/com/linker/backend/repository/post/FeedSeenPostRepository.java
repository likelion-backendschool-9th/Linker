package com.linker.backend.repository.post;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.post.FeedSeenPost;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FeedSeenPostRepository extends JpaRepository<FeedSeenPost, Long> {

	Optional<FeedSeenPost> findByUserIdAndPostId(long userId, long postId);

	/** POL-P-4: posts first seen before the feed session started (session order stays fixed while scrolling). */
	@Query("""
			select s.post.id from FeedSeenPost s
			where s.user.id = :userId
			  and s.createdAt < :before
			""")
	List<Long> findPostIdsSeenBefore(@Param("userId") long userId, @Param("before") Instant before);

	@Query("""
			select s.post.id from FeedSeenPost s
			where s.user.id = :userId
			  and s.post.id in :postIds
			""")
	List<Long> findSeenPostIds(
			@Param("userId") long userId,
			@Param("postIds") Collection<Long> postIds
	);
}
