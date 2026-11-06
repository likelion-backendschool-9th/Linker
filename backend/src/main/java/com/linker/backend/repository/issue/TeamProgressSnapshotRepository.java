package com.linker.backend.repository.issue;

import com.linker.backend.entity.issue.TeamProgressSnapshot;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TeamProgressSnapshotRepository extends JpaRepository<TeamProgressSnapshot, Long> {

  /** Stored history before today; today's value is always counted live. */
  @Query(
      "select s from TeamProgressSnapshot s where s.teamId = :team and s.snapshotDate >= :from"
          + " and s.snapshotDate < :today order by s.snapshotDate")
  List<TeamProgressSnapshot> findHistory(
      @Param("team") long teamId, @Param("from") LocalDate from, @Param("today") LocalDate today);

  /**
   * One row per non-deleted team for the day just ended. Native: a set-based INSERT ... SELECT
   * with ON CONFLICT DO NOTHING (rerun-safe) is PostgreSQL-only and has no JPQL form.
   */
  @Modifying
  @Query(
      value =
          """
          INSERT INTO team_progress_snapshots(team_id,snapshot_date,todo_count,in_progress_count,
            blocked_count,done_count,overdue_count)
          SELECT t.id,:date,
            count(i.id) FILTER(WHERE i.state<>'CLOSED' AND i.board_status='TODO'),
            count(i.id) FILTER(WHERE i.state<>'CLOSED' AND i.board_status='IN_PROGRESS'),
            count(i.id) FILTER(WHERE i.state<>'CLOSED' AND i.board_status='BLOCKED'),
            count(i.id) FILTER(WHERE i.state='CLOSED' OR i.board_status='DONE'),
            count(i.id) FILTER(WHERE i.state='OPEN' AND i.board_status<>'DONE' AND i.due_date<:today)
          FROM teams t LEFT JOIN issues i ON i.team_id=t.id AND i.deleted_at IS NULL
            AND EXISTS(SELECT 1 FROM team_repos vr JOIN github_repos gr ON gr.id=vr.repo_id
              WHERE vr.team_id=i.team_id AND vr.repo_id=i.repo_id AND gr.deleted_at IS NULL)
          WHERE t.status<>'DELETED' GROUP BY t.id
          ON CONFLICT(team_id,snapshot_date) DO NOTHING
          """,
      nativeQuery = true)
  int insertDaily(@Param("date") LocalDate date, @Param("today") LocalDate today);

  @Modifying
  @Query("delete from TeamProgressSnapshot s where s.snapshotDate < :cutoff")
  int deleteOlderThan(@Param("cutoff") LocalDate cutoff);
}
