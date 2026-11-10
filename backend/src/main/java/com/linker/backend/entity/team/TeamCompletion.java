package com.linker.backend.entity.team;
import jakarta.persistence.*;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
@Entity
@Table(name="team_completions")
public class TeamCompletion {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
  @Column(nullable=false)
  private Long teamId;
  @Column(nullable=false)
  private Long completedBy;
  @Column(nullable=false)
  private Instant completedAt;
  @Column(nullable=false)
  private Instant revertibleUntil;

  private Instant confirmedAt;

  private Instant revertedAt;
  @CreationTimestamp @Column(nullable=false,updatable=false) private Instant createdAt;
  @UpdateTimestamp @Column(nullable=false) private Instant updatedAt;
  protected TeamCompletion() {}
  public Long getId() { return id; }
  public Long getTeamId() { return teamId; }
  public Long getCompletedBy() { return completedBy; }
  public Instant getCompletedAt() { return completedAt; }
  public Instant getRevertibleUntil() { return revertibleUntil; }
  public Instant getConfirmedAt() { return confirmedAt; }
  public Instant getRevertedAt() { return revertedAt; }
  public static TeamCompletion complete(long team,long actor,Instant now,Instant until) {
    var value=new TeamCompletion();value.teamId=team;value.completedBy=actor;value.completedAt=now;value.revertibleUntil=until;return value;
  }
  public void confirm(Instant now) {confirmedAt=now;}
  public void revert(Instant now) {revertedAt=now;}

}
