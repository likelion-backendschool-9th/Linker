package com.linker.backend.repository.post;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.post.Post;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PostRepository extends JpaRepository<Post, Long> {

	boolean existsByAuthorIdAndRepoIdAndDeletedAtIsNull(long authorId, long repoId);

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
			  and p.visibility = com.linker.backend.entity.post.PostVisibility.VISIBLE
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
			  and p.visibility = com.linker.backend.entity.post.PostVisibility.VISIBLE
			  and p.author.status = com.linker.backend.entity.account.UserStatus.ACTIVE
			  and p.author.deletedAt is null
			order by p.createdAt desc, p.id desc
			""")
	List<Post> findVisibleForFeed();
}
