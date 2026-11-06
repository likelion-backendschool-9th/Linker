package com.linker.backend.repository.issue;

import com.linker.backend.entity.issue.Issue;
import com.linker.backend.global.error.ApiException;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Issue cache (pages 11–15, 07 my issues). Context, list, detail, sync, reminder and progress
 * reads live in {@link IssueRepositoryCustom} because they join B/A tables around the issue.
 */
public interface IssueRepository extends JpaRepository<Issue, Long>, IssueRepositoryCustom {

  static ApiException unavailable() {
    return new ApiException(503, "SERVICE_UNAVAILABLE", "팀·이슈 연결 준비가 필요해요");
  }
}
