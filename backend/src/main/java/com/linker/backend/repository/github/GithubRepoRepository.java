package com.linker.backend.repository.github;

import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.github.GithubRepo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GithubRepoRepository extends JpaRepository<GithubRepo, Long> {

	@Query("""
			select r from GithubRepo r
			where r.deletedAt is null
			  and r.isPrivate = false
			  and lower(r.ownerLogin) = lower(:ownerLogin)
			order by r.fullName asc
			""")
	List<GithubRepo> findPublicByOwner(@Param("ownerLogin") String ownerLogin);

	@Query("""
			select r from GithubRepo r
			where r.deletedAt is null
			  and r.isPrivate = false
			  and lower(r.ownerLogin) = lower(:ownerLogin)
			  and lower(r.fullName) like lower(concat('%', :q, '%'))
			order by r.fullName asc
			""")
	List<GithubRepo> findPublicByOwnerAndQuery(
			@Param("ownerLogin") String ownerLogin,
			@Param("q") String q
	);

	@Query("""
			select r from GithubRepo r
			where r.id = :id and r.deletedAt is null
			""")
	Optional<GithubRepo> findActiveById(@Param("id") long id);
}
