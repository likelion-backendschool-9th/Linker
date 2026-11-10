package com.linker.backend.repository.post;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.post.Comment;
import com.linker.backend.entity.post.type.PostVisibility;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommentRepository extends JpaRepository<Comment, Long> {

	@Query("""
			select c from Comment c
			join fetch c.author
			join fetch c.post
			left join fetch c.parent
			where c.post.id = :postId
			order by c.id asc
			""")
	List<Comment> findByPostIdOrderByIdAsc(@Param("postId") long postId);

	@Query("""
			select c from Comment c
			join fetch c.author
			join fetch c.post
			left join fetch c.parent
			where c.id = :id
			""")
	Optional<Comment> findDetailedById(@Param("id") long id);

	/** 23 comment limits: when my comments in the window were written, oldest first; deleted ones count too */
	@Query("""
			select c.createdAt from Comment c
			where c.author.id = :authorId and c.createdAt > :since
			order by c.createdAt asc
			""")
	List<Instant> findCreatedAtSince(@Param("authorId") long authorId, @Param("since") Instant since);

	/** Auto temporary hide at 5 reporters (Policy ch. 9): only a visible comment moves to review */
	@Modifying(flushAutomatically = true)
	@Query("""
			update Comment c set c.visibility = com.linker.backend.entity.post.type.PostVisibility.UNDER_REVIEW
			where c.id = :id and c.visibility = com.linker.backend.entity.post.type.PostVisibility.VISIBLE
			""")
	int markUnderReview(@Param("id") long id);

	/** An operator dismissing an auto-hidden case shows the comment again; operator hides stay */
	@Modifying(flushAutomatically = true)
	@Query("""
			update Comment c set c.visibility = com.linker.backend.entity.post.type.PostVisibility.VISIBLE
			where c.id = :id and c.visibility = com.linker.backend.entity.post.type.PostVisibility.UNDER_REVIEW
			""")
	int clearUnderReview(@Param("id") long id);

	boolean existsByParentIdAndDeletedAtIsNull(long parentId);

	long countByParentId(long parentId);

	@Query("""
			select c from Comment c
			join fetch c.post p
			join fetch p.author
			where c.author.id = :authorId
			""")
	List<Comment> findByAuthorId(@Param("authorId") long authorId);

	@Query("""
			select c.post.id, count(c)
			from Comment c
			join c.post p
			where c.post.id in :postIds
			  and c.deletedAt is null
			  and c.author.id <> p.author.id
			group by c.post.id
			""")
	List<Object[]> countNonAuthorByPostIds(@Param("postIds") Collection<Long> postIds);

	// Report hide, delete, or restore. A bulk update leaves updatedAt unchanged.
	@Modifying(flushAutomatically = true)
	@Query("""
			update Comment c
			set c.visibility = :visibility, c.deletedAt = :deletedAt
			where c.id = :id
			""")
	int updateReportedVisibility(
			@Param("id") long id,
			@Param("visibility") PostVisibility visibility,
			@Param("deletedAt") Instant deletedAt);
}
