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
