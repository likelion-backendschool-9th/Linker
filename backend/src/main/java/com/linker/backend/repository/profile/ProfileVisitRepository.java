package com.linker.backend.repository.profile;

import java.time.LocalDate;
import java.util.List;

import com.linker.backend.entity.profile.ProfileVisit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProfileVisitRepository extends JpaRepository<ProfileVisit, Long> {

  /** Same distinct-per-week semantics as A's Monday notice, scoped to the authenticated profile. */
  @Query("""
      select count(distinct v.visitor.id) from ProfileVisit v where v.profileUser.id=:userId
          and v.profileUser.userType='DEVELOPER' and v.visitor.userType='RECRUITER'
          and v.visitor.id<>:userId and v.visitDate>=:from and v.visitDate<=:to
      """)
  long countOwnDistinctRecruiters(long userId,LocalDate from,LocalDate to);


	boolean existsByProfileUser_IdAndVisitor_IdAndVisitDate(Long profileUserId, Long visitorId, LocalDate visitDate);

	/** Distinct recruiters per developer profile. The same recruiter on several days counts once. */
	@Query("""
			select visit.profileUser.id, count(distinct visit.visitor.id)
			from ProfileVisit visit
			where visit.visitDate >= :from
			  and visit.visitDate <= :to
			  and visit.profileUser.userType = com.linker.backend.entity.account.type.UserType.DEVELOPER
			  and visit.profileUser.deletedAt is null
			  and visit.profileUser.status <> com.linker.backend.entity.account.type.UserStatus.DELETED
			  and visit.visitor.userType = com.linker.backend.entity.account.type.UserType.RECRUITER
			group by visit.profileUser.id
			""")
	List<Object[]> countDistinctRecruiters(@Param("from") LocalDate from, @Param("to") LocalDate to);

	@Modifying(flushAutomatically = true)
	@Query("delete from ProfileVisit visit where visit.visitDate < :cutoff")
	void deleteByVisitDateBefore(LocalDate cutoff);
}
