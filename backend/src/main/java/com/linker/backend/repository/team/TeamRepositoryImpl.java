package com.linker.backend.repository.team;

import com.linker.backend.dto.github.response.GithubInstallationView;
import com.linker.backend.dto.team.request.CreateTeamRequest;
import com.linker.backend.dto.team.response.TeamConnectionView;
import com.linker.backend.dto.team.response.TeamConnectionView.LinkedRepo;
import com.linker.backend.dto.team.response.TeamConnectionView.StatusMapping;
import com.linker.backend.dto.team.response.TeamPersistenceView;
import com.linker.backend.dto.team.response.TeamSetupResponse.Created;
import com.linker.backend.entity.team.type.BoardStatus;
import com.linker.backend.entity.team.type.TeamStatus;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.integration.github.GithubTeamSource;
import com.linker.backend.service.user.OwnedTeamLookup.OwnedTeam;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import org.hibernate.ConnectionAcquisitionMode;
import org.hibernate.ConnectionReleaseMode;
import org.hibernate.Session;
import org.hibernate.SessionFactory;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Spring Data fragment. No component annotation: TeamRepository attaches it by name. */
@Transactional(readOnly = true)
public class TeamRepositoryImpl implements TeamRepositoryCustom {
  private final EntityManager entityManager;

  private final jakarta.persistence.EntityManagerFactory factory;
  private final com.linker.backend.repository.account.UserRepository users;

  public TeamRepositoryImpl(
      EntityManager entityManager,
      jakarta.persistence.EntityManagerFactory factory,
      com.linker.backend.repository.account.UserRepository users) {
    this.entityManager = entityManager;
    this.factory = factory;
    this.users = users;
  }

  @Override
  public List<OwnedTeam> findOwnedTeams(long userId) {
    // Preserve the withdrawal guard: even archived/deleted owned teams must not disappear here.
    return entityManager
        .createQuery(
            """
            select t.id, t.name from Team t, TeamMember m
            where m.teamId = t.id and m.userId = :user and m.role = 'OWNER'
              and m.leftAt is null order by t.id
            """,
            Object[].class)
        .setParameter("user", userId)
        .getResultList()
        .stream()
        .map(row -> new OwnedTeam((Long) row[0], (String) row[1]))
        .toList();
  }

  @Override
  public Optional<TeamConnectionView> findConnection(long teamId) {
    return entityManager
        .createQuery(
            """
            select t.id, i.githubInstallationId, t.githubOrgId, t.githubOrgLogin, t.status,
                   b.id, b.githubProjectNodeId, b.statusFieldId, b.startDateFieldId, b.dueDateFieldId
            from Team t join GithubInstallation i on i.id = t.installationId
            left join TeamProjectBoard b on b.teamId = t.id
            where t.id = :team and t.status <> 'DELETED'
            """,
            Object[].class)
        .setParameter("team", teamId)
        .getResultList()
        .stream()
        .map(
            row ->
                new TeamConnectionView(
                    (Long) row[0],
                    (Long) row[1],
                    (Long) row[2],
                    (String) row[3],
                    (TeamStatus) row[4],
                    (Long) row[5],
                    (String) row[6],
                    (String) row[7],
                    (String) row[8],
                    (String) row[9]))
        .findFirst();
  }

  @Override
  public List<LinkedRepo> findLinkedRepos(long teamId) {
    return entityManager
        .createQuery(
            """
            select r.id, r.githubRepoId, r.ownerLogin, r.name
            from TeamRepo tr join GithubRepo r on r.id = tr.repoId
            where tr.teamId = :team and r.deletedAt is null order by r.id
            """,
            Object[].class)
        .setParameter("team", teamId)
        .getResultList()
        .stream()
        .map(row -> new LinkedRepo((Long) row[0], (Long) row[1], (String) row[2], (String) row[3]))
        .toList();
  }

  @Override
  public List<StatusMapping> findBoardStatusMappings(long boardId) {
    return entityManager
        .createQuery(
            """
            select m.githubOptionId, m.linkerStatus, m.color from BoardStatusMapping m
            where m.boardId = :board order by m.githubOptionId
            """,
            Object[].class)
        .setParameter("board", boardId)
        .getResultList()
        .stream()
        .map(
            row ->
                new StatusMapping(
                    (String) row[0],
                    (BoardStatus) row[1],
                    (com.linker.backend.entity.team.type.BoardStatusColor) row[2]))
        .toList();
  }

  @Override
  public boolean ready(String... tables) {
    // PostgreSQL metadata is needed while C's optional issue tables are not formal migrations.
    if (tables.length == 0) return true;
    var predicates = new java.util.ArrayList<String>();
    Object[] names = new Object[tables.length];
    for (int i = 0; i < tables.length; i++) {
      predicates.add("to_regclass(:p" + i + ") is not null");
      names[i] = "public." + tables[i];
    }
    return Boolean.TRUE.equals(
        nativeQuery("select " + String.join(" and ", predicates), names).getSingleResult());
  }

  @Override
  public void requireSchema(String... tables) {
    if (!ready(tables)) throw new ApiException(503, "SERVICE_UNAVAILABLE", "팀 연결 준비가 필요해요");
  }

  @Override
  public TeamPersistenceView.Team team(long id) {
    requireSchema("teams", "team_members", "github_installations");
    return q(
            """
            select t.id,i.githubInstallationId,t.githubOrgId,t.githubOrgLogin,t.status
            from Team t join GithubInstallation i on i.id=t.installationId
            where t.id=:p0 and t.status<>'DELETED'
            """,
            Object[].class,
            id)
        .getResultList()
        .stream()
        .map(
            r ->
                new TeamPersistenceView.Team(
                    (Long) r[0], (Long) r[1], (Long) r[2], (String) r[3], r[4].toString()))
        .findFirst()
        .orElseThrow(() -> new ApiException(404, "NOT_FOUND", "팀을 찾을 수 없어요"));
  }

  @Override
  public Long linkedOrg(long orgId) {
    if (!ready("teams")) return null;
    return q("select t.id from Team t where t.githubOrgId=:p0", Long.class, orgId)
        .getResultList()
        .stream()
        .findFirst()
        .orElse(null);
  }

  @Override
  public boolean currentMember(long userId, long teamId) {
    return ready("team_members")
        && q(
                    "select count(m) from TeamMember m where m.userId=:p0 and m.teamId=:p1 and"
                        + " m.leftAt is null",
                    Long.class,
                    userId,
                    teamId)
                .getSingleResult()
            > 0;
  }

  @Override
  public boolean currentOwner(long userId, long teamId) {
    return q(
                "select count(m) from TeamMember m where m.userId=:p0 and m.teamId=:p1 and"
                    + " m.role='OWNER' and m.leftAt is null",
                Long.class,
                userId,
                teamId)
            .getSingleResult()
        > 0;
  }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public boolean lockActiveDeveloper(long userId) {
    return users.lockActiveDeveloper(userId).isPresent();
  }

  @Override
  public long countedTeams(long userId) {
    return q(
            "select count(m) from TeamMember m,Team t where m.teamId=t.id and m.userId=:p0 and"
                + " m.leftAt is null and t.status not in ('ARCHIVED','DELETED')",
            Long.class,
            userId)
        .getSingleResult();
  }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public Created create(
      long userId, GithubInstallationView verified, CreateTeamRequest command, Instant now) {
    long installation = upsertInstallation(userId, verified, now);
    var t =
        com.linker.backend.entity.team.Team.create(
            installation,
            verified.orgId(),
            verified.login(),
            command.name().trim(),
            command.description(),
            verified.avatarUrl(),
            userId);
    entityManager.persist(t);
    entityManager.persist(com.linker.backend.entity.team.TeamMember.owner(t.getId(), userId, now));
    var room = com.linker.backend.entity.chat.ChatRoom.team(t.getId());
    entityManager.persist(room);
    entityManager.persist(com.linker.backend.entity.chat.ChatRoomMember.join(room, userId));
    entityManager.flush();
    return new Created(t.getId(), t.getName(), room.getId());
  }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public Created reconnect(
      long teamId, long userId, GithubInstallationView verified, String nextStatus, Instant now) {
    long installation = upsertInstallation(userId, verified, now);
    bulk(
        "update Team t set"
            + " t.installationId=:p0,t.githubOrgLogin=:p1,t.status=:p2,t.readOnlySince=null,t.updatedAt=:p3"
            + " where t.id=:p4",
        installation,
        verified.login(),
        TeamStatus.valueOf(nextStatus),
        now,
        teamId);
    var r =
        q(
                "select t.id,t.name,r.id from Team t,ChatRoom r where r.teamId=t.id and"
                    + " r.roomType='TEAM' and t.id=:p0",
                Object[].class,
                teamId)
            .getSingleResult();
    return new Created((Long) r[0], (String) r[1], (Long) r[2]);
  }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public long upsertInstallation(long userId, GithubInstallationView v, Instant now) {
    // Atomic ON CONFLICT with identity RETURNING cannot be expressed in JPQL.
    return returning(
        """
        insert into github_installations(github_installation_id,account_id,account_login,account_type,repository_selection,installed_by,created_at,updated_at)
        values (:p0,:p1,:p2,'Organization',:p3,:p4,:p5,:p5)
        on conflict(github_installation_id) do update set account_login=excluded.account_login,repository_selection=excluded.repository_selection,removed_at=null,suspended_at=null,updated_at=excluded.updated_at
        where github_installations.account_id=excluded.account_id returning id
        """,
        v.installationId(),
        v.orgId(),
        v.login(),
        v.repositorySelection(),
        userId,
        now);
  }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public long cacheRepo(GithubTeamSource.Repository r, Instant now) {
    // Shared repo identity must remain atomic across B/E writers (ON CONFLICT / RETURNING).
    return returning(
        """
        insert into github_repos(github_repo_id,owner_login,name,full_name,description,primary_language,stargazers_count,forks_count,html_url,is_private,is_fork,parent_full_name,default_branch,metadata_synced_at,created_at,updated_at)
        values (:p0,:p1,:p2,:p3,:p4,:p5,:p6,:p7,:p8,:p9,:p10,:p11,:p12,:p13,:p13,:p13)
        on conflict(github_repo_id) do update set owner_login=excluded.owner_login,name=excluded.name,full_name=excluded.full_name,description=excluded.description,
        primary_language=excluded.primary_language,stargazers_count=excluded.stargazers_count,forks_count=excluded.forks_count,html_url=excluded.html_url,
        is_private=excluded.is_private,is_fork=excluded.is_fork,parent_full_name=excluded.parent_full_name,default_branch=excluded.default_branch,
        metadata_synced_at=excluded.metadata_synced_at,deleted_at=null,updated_at=excluded.updated_at returning id
        """,
        r.id(),
        r.owner(),
        r.name(),
        r.fullName(),
        r.description(),
        r.language(),
        r.stars(),
        r.forks(),
        r.htmlUrl(),
        r.isPrivate(),
        r.isFork(),
        r.parentFullName(),
        r.defaultBranch(),
        now);
  }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public void saveRepos(
      long teamId, long userId, List<GithubTeamSource.Repository> repos, Instant now) {
    requireSchema("github_repos", "team_repos");
    bulk("delete from TeamRepo r where r.teamId=:p0", teamId);
    for (var repo : repos)
      entityManager.persist(
          com.linker.backend.entity.team.TeamRepo.connect(teamId, cacheRepo(repo, now), userId));
    entityManager.flush();
  }

  @Override
  public List<GithubTeamSource.Repository> repos(long teamId) {
    requireSchema("team_repos", "github_repos");
    return q(
            """
            select r.githubRepoId,r.ownerLogin,r.name,r.fullName,r.description,r.primaryLanguage,
                   r.stargazersCount,r.forksCount,r.htmlUrl,r.isPrivate,r.isFork,r.parentFullName,r.defaultBranch
            from TeamRepo tr join GithubRepo r on r.id=tr.repoId
            where tr.teamId=:p0 and r.deletedAt is null order by r.githubRepoId
            """,
            Object[].class,
            teamId)
        .getResultList()
        .stream()
        .map(
            r ->
                new GithubTeamSource.Repository(
                    (Long) r[0],
                    (String) r[1],
                    (String) r[2],
                    (String) r[3],
                    (String) r[4],
                    (String) r[5],
                    (Integer) r[6],
                    (Integer) r[7],
                    (String) r[8],
                    (Boolean) r[9],
                    (Boolean) r[10],
                    (String) r[11],
                    (String) r[12]))
        .toList();
  }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public void saveBoard(
      long teamId,
      long userId,
      GithubTeamSource.Project p,
      boolean created,
      String statusField,
      String startField,
      String dueField,
      Map<String, String> mapping,
      Instant now) {
    requireSchema("team_project_boards", "board_status_mappings");
    // One board per team, atomically retaining its internal identity on retries.
    long board =
        returning(
            """
            insert into team_project_boards(team_id,github_project_node_id,project_number,title,created_by_linker,status_field_id,start_date_field_id,due_date_field_id,connected_by,created_at,updated_at)
            values (:p0,:p1,:p2,:p3,:p4,:p5,:p6,:p7,:p8,:p9,:p9)
            on conflict(team_id) do update set github_project_node_id=excluded.github_project_node_id,project_number=excluded.project_number,
            title=excluded.title,created_by_linker=excluded.created_by_linker,status_field_id=excluded.status_field_id,start_date_field_id=excluded.start_date_field_id,
            due_date_field_id=excluded.due_date_field_id,connected_by=excluded.connected_by,updated_at=excluded.updated_at returning id
            """,
            teamId,
            p.id(),
            p.number(),
            p.title(),
            created,
            statusField,
            startField,
            dueField,
            userId,
            now);
    bulk("delete from BoardStatusMapping m where m.boardId=:p0", board);
    var field =
        p.fields().stream().filter(f -> f.id().equals(statusField)).findFirst().orElseThrow();
    for (var option : field.options())
      entityManager.persist(
          com.linker.backend.entity.team.BoardStatusMapping.map(
              board,
              option.id(),
              option.name(),
              BoardStatus.valueOf(mapping.getOrDefault(option.id(), "OTHER")),
              com.linker.backend.entity.team.type.BoardStatusColor.parse(option.color())));
    entityManager.flush();
  }

  @Override
  public String boardId(long teamId) {
    requireSchema("team_project_boards");
    return q(
            "select b.githubProjectNodeId from TeamProjectBoard b where b.teamId=:p0",
            String.class,
            teamId)
        .getResultList()
        .stream()
        .findFirst()
        .orElse(null);
  }

  @Override
  public boolean boardCreatedByLinker(long teamId) {
    return Boolean.TRUE.equals(
        q(
                "select b.createdByLinker from TeamProjectBoard b where b.teamId=:p0",
                Boolean.class,
                teamId)
            .getSingleResult());
  }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public void saveBasePermission(long teamId, String permission, Instant now) {
    bulk(
        "update Team t set t.orgBasePermission=:p0,t.updatedAt=:p1 where t.id=:p2",
        permission,
        now,
        teamId);
  }

  @Override
  public boolean isActiveUser(long userId) {
    return q(
                "select count(u) from User u where u.id=:p0 and u.status='ACTIVE' and u.deletedAt"
                    + " is null",
                Long.class,
                userId)
            .getSingleResult()
        > 0;
  }

  @Override
  public void requireActive(long userId) {
    if (!isActiveUser(userId)) throw new ApiException(403, "FORBIDDEN", "이 기능을 사용할 수 없어요");
  }

  @Override
  public String setupRevision(long teamId) {
    // PostgreSQL extract(epoch)::text / string_agg preserve existing A→B→A job fingerprints
    // exactly.
    Object team =
        nativeQuery("select extract(epoch from updated_at)::text from teams where id=:p0", teamId)
            .getSingleResult();
    Object repos =
        nativeQuery(
                "select string_agg(id::text||':'||repo_id::text||':'||extract(epoch from"
                    + " updated_at)::text,',' order by id) from team_repos where team_id=:p0",
                teamId)
            .getSingleResult();
    Object board =
        nativeQuery(
                "select string_agg(id::text||':'||extract(epoch from updated_at)::text,',') from"
                    + " team_project_boards where team_id=:p0",
                teamId)
            .getSingleResult();
    return team + "|" + repos + "|" + board;
  }

  @Override
  public long repoId(long githubRepoId) {
    return q("select r.id from GithubRepo r where r.githubRepoId=:p0", Long.class, githubRepoId)
        .getSingleResult();
  }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public void cachePullRequest(
      long teamId, long repo, GithubTeamSource.PullRequest pr, Instant now) {
    // PostgreSQL ON CONFLICT applies the source revision check atomically for delayed deliveries.
    nativeBulk(
        """
        insert into pull_requests(team_id,repo_id,github_pr_id,number,title,state,draft,author_login,html_url,merged_at,closed_at,github_updated_at,created_at,updated_at)
        values (:p0,:p1,:p2,:p3,:p4,:p5,:p6,:p7,:p8,:p9,:p10,:p11,:p12,:p12)
        on conflict(github_pr_id) do update set title=excluded.title,state=excluded.state,draft=excluded.draft,author_login=excluded.author_login,
        html_url=excluded.html_url,merged_at=excluded.merged_at,closed_at=excluded.closed_at,github_updated_at=excluded.github_updated_at,updated_at=excluded.updated_at
        where pull_requests.github_updated_at<=excluded.github_updated_at
        """,
        teamId,
        repo,
        pr.id(),
        pr.number(),
        pr.title(),
        pr.state(),
        pr.draft(),
        pr.author(),
        pr.url(),
        pr.mergedAt(),
        pr.closedAt(),
        pr.updatedAt(),
        now);
  }

  @Override
  public List<TeamPersistenceView.GithubMember> githubMembers(long teamId) {
    return q(
            """
            select m.userId,m.githubOrgState,a.providerUserId from TeamMember m,AuthIdentity a
            where a.user.id=m.userId and a.provider='GITHUB' and m.teamId=:p0 and m.leftAt is null
            """,
            Object[].class,
            teamId)
        .getResultList()
        .stream()
        .map(r -> new TeamPersistenceView.GithubMember((Long) r[0], r[1].toString(), (String) r[2]))
        .toList();
  }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public void confirmMember(long teamId, long userId, Instant now) {
    bulk(
        "update TeamMember m set m.githubOrgState='MEMBER',m.updatedAt=:p0 where m.teamId=:p1 and"
            + " m.userId=:p2 and m.leftAt is null",
        now,
        teamId,
        userId);
  }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public int removeOrgMember(long teamId, long userId, Instant now) {
    return bulk(
        "update TeamMember m set"
            + " m.leftAt=:p0,m.leaveType='ORG_REMOVED',m.githubOrgState='NOT_MEMBER',m.updatedAt=:p0"
            + " where m.teamId=:p1 and m.userId=:p2 and m.leftAt is null",
        now,
        teamId,
        userId);
  }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public void closeChatMembership(long teamId, long userId, Instant now) {
    bulk(
        "update ChatRoomMember m set m.leftAt=:p0,m.updatedAt=:p0 where m.userId=:p1 and m.leftAt"
            + " is null and m.room.id in (select r.id from ChatRoom r where r.teamId=:p2 and"
            + " r.roomType='TEAM')",
        now,
        userId,
        teamId);
  }

  @Override
  public List<Long> currentOwnerIds(long teamId, boolean activeAccountsOnly) {
    String sql =
        "select m.userId from TeamMember m where m.teamId=:p0 and m.role='OWNER' and m.leftAt is"
            + " null";
    if (activeAccountsOnly)
      sql +=
          " and exists(select 1 from User u where u.id=m.userId and u.status<>'DELETED' and"
              + " u.deletedAt is null)";
    return q(sql, Long.class, teamId).getResultList();
  }

  @Override
  public boolean canReceiveNotification(long userId) {
    return q(
                "select count(u) from User u where u.id=:p0 and u.status<>'DELETED' and u.deletedAt"
                    + " is null",
                Long.class,
                userId)
            .getSingleResult()
        > 0;
  }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public void markInstallationRemoved(long installationId, Instant now) {
    bulk(
        "update GithubInstallation i set i.removedAt=coalesce(i.removedAt,:p0),i.updatedAt=:p0"
            + " where i.githubInstallationId=:p1",
        now,
        installationId);
  }

  @Override
  public long creatorId(long teamId) {
    return q("select t.createdBy from Team t where t.id=:p0", Long.class, teamId).getSingleResult();
  }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public void suspendInstallation(long localId, Instant suspendedAt) {
    bulk("update GithubInstallation i set i.suspendedAt=:p0 where i.id=:p1", suspendedAt, localId);
  }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public void linkInstallation(long teamId, long localId, String login, Instant now) {
    bulk(
        "update Team t set t.installationId=:p0,t.githubOrgLogin=:p1,t.updatedAt=:p2 where"
            + " t.id=:p3",
        localId,
        login,
        now,
        teamId);
  }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public int markReadOnly(long teamId, Instant now) {
    return bulk(
        "update Team t set"
            + " t.status='READ_ONLY',t.readOnlySince=coalesce(t.readOnlySince,:p0),t.updatedAt=:p0"
            + " where t.id=:p1 and t.status in ('ACTIVE','COMPLETED')",
        now,
        teamId);
  }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public void restoreActive(long teamId, Instant now) {
    bulk(
        "update Team t set t.status='ACTIVE',t.readOnlySince=null,t.updatedAt=:p0 where t.id=:p1"
            + " and t.status='READ_ONLY'",
        now,
        teamId);
  }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public void renameOrganization(
      long teamId, long installationId, String oldLogin, String login, Instant now) {
    bulk(
        "update Team t set t.githubOrgLogin=:p0,t.updatedAt=:p1 where t.id=:p2",
        login,
        now,
        teamId);
    bulk(
        "update GithubInstallation i set i.accountLogin=:p0,i.updatedAt=:p1 where"
            + " i.githubInstallationId=:p2",
        login,
        now,
        installationId);
    if (ready("team_repos", "github_repos"))
      bulk(
          "update GithubRepo r set"
              + " r.ownerLogin=:p0,r.fullName=concat(:p0,'/',r.name),r.updatedAt=:p1 where"
              + " r.ownerLogin=:p2 and exists(select 1 from TeamRepo tr where tr.repoId=r.id and"
              + " tr.teamId=:p3)",
          login,
          now,
          oldLogin,
          teamId);
  }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public void archiveReadOnly(Instant threshold, Instant now) {
    bulk(
        "update Team t set t.status='ARCHIVED',t.archivedAt=:p0,t.updatedAt=:p0 where"
            + " t.status='READ_ONLY' and t.readOnlySince<=:p1",
        now,
        threshold);
  }

  private <T> jakarta.persistence.TypedQuery<T> q(String jpql, Class<T> type, Object... args) {
    var query = entityManager.createQuery(jpql, type);
    for (int i = 0; i < args.length; i++) query.setParameter("p" + i, args[i]);
    return query;
  }

  private jakarta.persistence.Query nativeQuery(String sql, Object... args) {
    var query = entityManager.createNativeQuery(sql);
    for (int i = 0; i < args.length; i++) query.setParameter("p" + i, args[i]);
    return query;
  }

  private int bulk(String jpql, Object... args) {
    entityManager.flush();
    var query = entityManager.createQuery(jpql);
    for (int i = 0; i < args.length; i++) query.setParameter("p" + i, args[i]);
    int result = query.executeUpdate();
    entityManager.clear();
    return result;
  }

  private long returning(String sql, Object... args) {
    entityManager.flush();
    long result = ((Number) nativeQuery(sql, args).getSingleResult()).longValue();
    entityManager.clear();
    return result;
  }

  private void nativeBulk(String sql, Object... args) {
    entityManager.flush();
    nativeQuery(sql, args).executeUpdate();
    entityManager.clear();
  }

  @Override
  @Transactional(propagation = Propagation.NEVER)
  public <T> T withTeamSetupLock(long id, Supplier<T> operation) {
    return withSetupKey("team:" + id, operation);
  }

  @Override
  @Transactional(propagation = Propagation.NEVER)
  public <T> T withOrganizationSetupLock(long id, Supplier<T> operation) {
    return withSetupKey("org:" + id, operation);
  }

  private <T> T withSetupKey(String scope, Supplier<T> operation) {
    if (org.springframework.transaction.support.TransactionSynchronizationManager
        .isActualTransactionActive())
      throw new IllegalStateException("Setup must start outside a transaction");
    // PostgreSQL session advisory locks require the SAME physical connection until unlock.
    // This independent Hibernate session holds its connection, but opens no DB transaction.
    try (Session session =
        factory
            .unwrap(SessionFactory.class)
            .withOptions()
            .connectionHandling(ConnectionAcquisitionMode.AS_NEEDED, ConnectionReleaseMode.ON_CLOSE)
            .openSession()) {
      session.doWork(c -> c.setAutoCommit(true));
      String key = "linker:team-setup:" + scope;
      boolean held =
          Boolean.TRUE.equals(
              session
                  .createNativeQuery(
                      "select pg_try_advisory_lock(hashtextextended(:key,0))", Boolean.class)
                  .setParameter("key", key)
                  .getSingleResult());
      if (!held) throw new ApiException(409, "STATE_CONFLICT", "팀 설정을 처리 중이에요. 잠시 후 다시 시도해 주세요");
      try {
        return operation.get();
      } finally {
        try {
          boolean released =
              Boolean.TRUE.equals(
                  session
                      .createNativeQuery(
                          "select pg_advisory_unlock(hashtextextended(:key,0))", Boolean.class)
                      .setParameter("key", key)
                      .getSingleResult());
          if (!released) throw new IllegalStateException("Setup session lost its lock");
        } catch (RuntimeException failure) {
          session.doWork(c -> c.abort(Runnable::run));
          throw failure;
        }
      }
    } catch (jakarta.persistence.PersistenceException failure) {
      throw new ApiException(503, "SERVICE_UNAVAILABLE", "팀 설정 연결을 확인해 주세요");
    }
  }

  @Override
  public List<TeamPersistenceView.WorkspaceTeam> findCurrentTeams(long userId) {
    // V22 supplies C's Issue entity. Keep the missing-cache fallback but fold its aggregate into
    // the same JPQL as the team/chat projection. Zero is still unknown until full-sync is proven.
    String issueCount = ready("issues", "github_repos", "team_repos") ? """
        nullif((select count(issue) from Issue issue, GithubRepo repo, TeamRepo linked
          where issue.teamId=t.id and issue.state='OPEN' and issue.deletedAt is null
            and repo.id=issue.repoId and repo.deletedAt is null
            and linked.repoId=issue.repoId and linked.teamId=issue.teamId),0)
        """ : "cast(null as Long)";
    // Scalar projections avoid loading members/messages/rooms per team (no N+1).
    // Keep D's unread semantics, including hidden/deleted placeholders and null senders.
    return q(
            """
            select t.id,t.name,t.avatarUrl,t.status,mine.role,mine.joinedAt,
              (select count(member) from TeamMember member where member.teamId=t.id and member.leftAt is null),
              case when participant.id is not null then room.id end,
              case when participant.id is not null then (
                select count(message) from ChatMessage message where message.room.id=room.id
                  and (participant.lastReadMessageId is null or message.id>participant.lastReadMessageId)
                  and (message.senderId is null or message.senderId<>mine.userId)) end,
              %s
            from Team t join TeamMember mine on mine.teamId=t.id
            left join ChatRoom room on room.teamId=t.id and room.roomType='TEAM'
            left join ChatRoomMember participant on participant.room.id=room.id
              and participant.userId=mine.userId and participant.leftAt is null and participant.hiddenAt is null
            where mine.userId=:p0 and mine.leftAt is null and t.status<>'DELETED'
            order by case when t.status='ARCHIVED' then 1 else 0 end,mine.joinedAt desc,t.id desc
            """.formatted(issueCount),
            Object[].class,
            userId)
        .getResultList()
        .stream()
        .map(
            r ->
                new TeamPersistenceView.WorkspaceTeam(
                    (Long) r[0],
                    (String) r[1],
                    (String) r[2],
                    r[3].toString(),
                    r[4].toString(),
                    (Long) r[6],
                    (Instant) r[5],
                    (Long) r[7],
                    (Long) r[8],
                    (Long) r[9]))
        .toList();
  }
}
