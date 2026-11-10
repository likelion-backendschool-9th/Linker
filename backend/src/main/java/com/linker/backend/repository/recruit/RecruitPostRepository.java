package com.linker.backend.repository.recruit;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.recruit.RecruitPost;
import com.linker.backend.entity.recruit.type.RecruitRoleType;
import com.linker.backend.entity.recruit.type.RecruitStatus;
import com.linker.backend.entity.recruit.type.RecruitVisibility;
import com.linker.backend.entity.recruit.type.WorkMode;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RecruitPostRepository extends JpaRepository<RecruitPost, Long> {

  /** WBS S18: only open, visible recruitment posts by active developers are indexable. */
  @Query("""
      select new com.linker.backend.dto.sitemap.SitemapItem(
          p.id, concat('/recruits/', cast(p.id as String)), p.updatedAt)
      from RecruitPost p where p.deletedAt is null and p.visibility='VISIBLE' and p.status='OPEN'
        and p.author.userType='DEVELOPER' and p.author.status='ACTIVE'
        and p.author.deletedAt is null
      order by p.id asc
      """)
  List<com.linker.backend.dto.sitemap.SitemapItem> findIndexable(Pageable page);

	long countByAuthorIdAndStatusAndDeletedAtIsNull(long authorId, RecruitStatus status);

	@Query("""
			select p from RecruitPost p
			left join fetch p.roles
			left join fetch p.author
			where p.id = :id and p.deletedAt is null
			""")
	Optional<RecruitPost> findDetailedById(@Param("id") long id);

	@Query("""
			select distinct p from RecruitPost p
			left join fetch p.roles
			where p.status = :status
			  and p.deletedAt is null
			""")
	List<RecruitPost> findOpenWithRoles(@Param("status") RecruitStatus status);

	@Query("""
			select distinct p from RecruitPost p
			left join p.roles r
			left join p.tags t
			left join t.tag tag
			where p.status = :status
			  and p.visibility = :visibility
			  and p.deletedAt is null
			  and (:role is null or r.role = :role)
			  and (:mode is null or p.workMode = :mode)
			  and (:tech is null or tag.name = :tech)
			  and (:excludeEmpty = true or p.author.id not in :excludedAuthorIds)
			order by p.sortAt desc, p.id desc
			""")
	List<RecruitPost> findOpenNewest(
			@Param("status") RecruitStatus status,
			@Param("visibility") RecruitVisibility visibility,
			@Param("role") RecruitRoleType role,
			@Param("mode") WorkMode mode,
			@Param("tech") String tech,
			@Param("excludeEmpty") boolean excludeEmpty,
			@Param("excludedAuthorIds") Collection<Long> excludedAuthorIds,
			Pageable pageable
	);

	@Query("""
			select distinct p from RecruitPost p
			left join p.roles r
			left join p.tags t
			left join t.tag tag
			where p.status = :status
			  and p.visibility = :visibility
			  and p.deletedAt is null
			  and (:role is null or r.role = :role)
			  and (:mode is null or p.workMode = :mode)
			  and (:tech is null or tag.name = :tech)
			  and (:excludeEmpty = true or p.author.id not in :excludedAuthorIds)
			order by p.deadline asc, p.id asc
			""")
	List<RecruitPost> findOpenByDeadline(
			@Param("status") RecruitStatus status,
			@Param("visibility") RecruitVisibility visibility,
			@Param("role") RecruitRoleType role,
			@Param("mode") WorkMode mode,
			@Param("tech") String tech,
			@Param("excludeEmpty") boolean excludeEmpty,
			@Param("excludedAuthorIds") Collection<Long> excludedAuthorIds,
			Pageable pageable
	);

	@Query("""
			select p from RecruitPost p
			where p.author.id = :authorId and p.deletedAt is null
			order by p.sortAt desc, p.id desc
			""")
	List<RecruitPost> findMine(@Param("authorId") long authorId, Pageable pageable);

	// Report hide, delete, or restore. A bulk update leaves updatedAt unchanged.
	@Modifying(flushAutomatically = true)
	@Query("""
			update RecruitPost p
			set p.visibility = :visibility, p.deletedAt = :deletedAt
			where p.id = :id
			""")
	int updateReportedVisibility(
			@Param("id") long id,
			@Param("visibility") RecruitVisibility visibility,
			@Param("deletedAt") Instant deletedAt);
}
