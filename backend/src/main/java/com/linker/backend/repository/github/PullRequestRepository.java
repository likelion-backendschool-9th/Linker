package com.linker.backend.repository.github;

import com.linker.backend.entity.github.PullRequest;
import com.linker.backend.entity.github.type.PullRequestState;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PullRequestRepository extends JpaRepository<PullRequest, Long> {
  @Query("""
      select p from PullRequest p, GithubRepo repo, Team t
      where p.teamId = :teamId and p.state = :state and repo.id=p.repoId and t.id=p.teamId
        and repo.deletedAt is null and lower(repo.ownerLogin)=lower(t.githubOrgLogin)
        and exists(select 1 from TeamRepo r where r.teamId=p.teamId and r.repoId=p.repoId)
      order by p.githubUpdatedAt desc, p.id desc
      """)
  List<PullRequest> findLinkedByState(long teamId, PullRequestState state);
}
