package com.linker.backend.entity.team;

import jakarta.persistence.*;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import com.linker.backend.entity.team.type.GithubInvitationStatus;

@Entity
@Table(name = "github_org_invitations")
public class GithubOrgInvitation {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private Long teamId;

  @Column(nullable = false)
  private Long inviterId;

  @Column(nullable = false)
  private Long inviteeUserId;

  @Column(nullable = false)
  private String inviteeLogin;

  private Long githubInvitationId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 16)
  private GithubInvitationStatus status;

  private Instant remindedAt;

  @CreationTimestamp
  @Column(nullable = false, updatable = false)
  private Instant createdAt;

  @UpdateTimestamp
  @Column(nullable = false)
  private Instant updatedAt;

  protected GithubOrgInvitation() {}

  public static GithubOrgInvitation pending(long teamId, long inviter, long invitee, String login) {
    var row = new GithubOrgInvitation();
    row.teamId = teamId;
    row.inviterId = inviter;
    row.inviteeUserId = invitee;
    row.inviteeLogin = login;
    row.status = GithubInvitationStatus.PENDING;
    return row;
  }

  public void sent(long githubId) {
    githubInvitationId = githubId;
    status = GithubInvitationStatus.PENDING;
  }

  public void pending() {
    status = GithubInvitationStatus.PENDING;
  }

  public void expire() {
    status = GithubInvitationStatus.EXPIRED;
  }

  public void accept() {
    status = GithubInvitationStatus.ACCEPTED;
  }

  public void fail() {
    status = GithubInvitationStatus.FAILED;
  }

  public Long getId() {
    return id;
  }

  public GithubInvitationStatus getStatus() {
    return status;
  }

  public Long getGithubInvitationId() {
    return githubInvitationId;
  }
}
