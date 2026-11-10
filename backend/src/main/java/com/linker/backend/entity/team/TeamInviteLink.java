package com.linker.backend.entity.team;

import jakarta.persistence.*;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "team_invite_links")
public class TeamInviteLink {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private Long teamId;

  @Column(nullable = false, unique = true, length = 64)
  private String tokenHash;

  @Column(nullable = false)
  private Long createdBy;

  @Column(nullable = false)
  private Instant expiresAt;

  private Instant revokedAt;

  @CreationTimestamp
  @Column(nullable = false, updatable = false)
  private Instant createdAt;

  @UpdateTimestamp
  @Column(nullable = false)
  private Instant updatedAt;

  protected TeamInviteLink() {}

  public static TeamInviteLink create(long teamId, String hash, long creator, Instant expires) {
    var link = new TeamInviteLink();
    link.teamId = teamId;
    link.tokenHash = hash;
    link.createdBy = creator;
    link.expiresAt = expires;
    return link;
  }

  public void revoke(Instant now) {
    if (revokedAt == null) revokedAt = now;
  }

  public Long getId() {
    return id;
  }

  public Long getTeamId() {
    return teamId;
  }

  public Long getCreatedBy() {
    return createdBy;
  }

  public String getTokenHash() {
    return tokenHash;
  }

  public Instant getExpiresAt() {
    return expiresAt;
  }

  public Instant getRevokedAt() {
    return revokedAt;
  }
}
