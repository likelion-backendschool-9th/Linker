package com.linker.backend.repository.post;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.post.Post;
import com.linker.backend.entity.post.type.PostVisibility;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PostRepository extends JpaRepository<Post, Long> {

  /** Public sitemap projection only: no body, private account fields or collection loading. */
  @Query("""
      select new com.linker.backend.dto.sitemap.SitemapItem(
          p.id, concat('/posts/', cast(p.id as String)), p.updatedAt)
      from Post p where p.deletedAt is null and p.visibility='VISIBLE'
        and p.author.userType='DEVELOPER' and p.author.status='ACTIVE'
        and p.author.deletedAt is null
      order by p.id asc
      """)
  List<com.linker.backend.dto.sitemap.SitemapItem> findIndexable(org.springframework.data.domain.Pageable page);

  /** Own statistics also cover hidden posts; public visibility is enforced on public readers. */
  @Query("select p from Post p where p.author.id=:userId and p.deletedAt is null order by p.createdAt desc,p.id desc")
  List<Post> findOwnStatsPosts(long userId);


	boolean existsByAuthorIdAndRepoIdAndDeletedAtIsNull(long authorId, long repoId);

	List<Post> findByAuthor_Id(long authorId);

	@Query("""
			select p from Post p
			join fetch p.repo
			join fetch p.author
			where p.author.id = :authorId
			  and p.deletedAt is null
			  and p.visibility = com.linker.backend.entity.post.type.PostVisibility.VISIBLE
			order by p.createdAt desc, p.id desc
			""")
	List<Post> findVisibleByAuthorId(@Param("authorId") long authorId);

	@Query("""
			select p.repo.id from Post p
			where p.author.id = :authorId
			  and p.deletedAt is null
			  and p.repo.id in :repoIds
			""")
	List<Long> findPostedRepoIds(
			@Param("authorId") long authorId,
			@Param("repoIds") Collection<Long> repoIds
	);

	@Query("""
			select p from Post p
			join fetch p.repo
			join fetch p.author
			where p.id = :id and p.deletedAt is null
			""")
	Optional<Post> findDetailedById(@Param("id") long id);

	@Query("""
			select p from Post p
			join fetch p.repo
			join fetch p.author
			where p.repo.id = :repoId
			  and p.id <> :excludePostId
			  and p.deletedAt is null
			  and p.visibility = com.linker.backend.entity.post.type.PostVisibility.VISIBLE
			order by p.createdAt desc
			""")
	List<Post> findSameRepoVisible(
			@Param("repoId") long repoId,
			@Param("excludePostId") long excludePostId
	);

	@Query("""
			select p from Post p
			join fetch p.repo
			join fetch p.author
			where p.deletedAt is null
			  and p.visibility = com.linker.backend.entity.post.type.PostVisibility.VISIBLE
			  and p.author.status = com.linker.backend.entity.account.type.UserStatus.ACTIVE
			  and p.author.deletedAt is null
			order by p.createdAt desc, p.id desc
			""")
	List<Post> findVisibleForFeed();

	// Report hide, delete, or restore. A bulk update leaves updatedAt unchanged.
	@Modifying(flushAutomatically = true)
	@Query("""
			update Post p
			set p.visibility = :visibility, p.deletedAt = :deletedAt
			where p.id = :id
			""")
	int updateReportedVisibility(
			@Param("id") long id,
			@Param("visibility") PostVisibility visibility,
			@Param("deletedAt") Instant deletedAt);
}
