package com.linker.backend.repository.recruit;

import java.util.Collection;
import java.util.List;

import com.linker.backend.entity.recruit.RecruitPost;
import com.linker.backend.entity.recruit.RecruitRoleType;
import com.linker.backend.entity.recruit.RecruitStatus;
import com.linker.backend.entity.recruit.RecruitVisibility;
import com.linker.backend.entity.recruit.WorkMode;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RecruitPostRepository extends JpaRepository<RecruitPost, Long> {

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
}
