package com.linker.backend.repository.post;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.post.FeedSeenPost;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FeedSeenPostRepository extends JpaRepository<FeedSeenPost, Long> {

	Optional<FeedSeenPost> findByUserIdAndPostId(long userId, long postId);

	@Query("""
			select s.post.id from FeedSeenPost s
			where s.user.id = :userId
			""")
	List<Long> findPostIdsByUserId(@Param("userId") long userId);

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
