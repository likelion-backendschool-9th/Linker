package com.linker.backend.repository.recruit;

import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.recruit.Application;
import com.linker.backend.entity.recruit.ApplicationStatus;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ApplicationRepository extends JpaRepository<Application, Long> {

	@Query("""
			select a from Application a
			join fetch a.recruitPost p
			join fetch p.author
			join fetch a.recruitRole
			where a.applicant.id = :applicantId
			  and a.status <> :canceled
			  and (:status is null or a.status = :status)
			order by a.createdAt desc, a.id desc
			""")
	List<Application> findMine(
			@Param("applicantId") long applicantId,
			@Param("status") ApplicationStatus status,
			@Param("canceled") ApplicationStatus canceled,
			Pageable pageable
	);

	@Query("""
			select a from Application a
			join fetch a.applicant
			join fetch a.recruitPost
			join fetch a.recruitRole
			where a.id = :id
			""")
	Optional<Application> findDetailedById(@Param("id") long id);

	@Query("""
			select distinct a.recruitRole.id from Application a
			where a.recruitPost.id = :recruitPostId
			  and a.status <> :canceled
			""")
	List<Long> findLockedRoleIds(
			@Param("recruitPostId") long recruitPostId,
			@Param("canceled") ApplicationStatus canceled
	);

	@Query("""
			select a from Application a
			join fetch a.applicant
			join fetch a.recruitRole
			where a.recruitPost.id = :recruitPostId
			  and a.status = :pending
			""")
	List<Application> findPendingByRecruitPostId(
			@Param("recruitPostId") long recruitPostId,
			@Param("pending") ApplicationStatus pending
	);
}
