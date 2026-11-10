package com.linker.backend.entity.team;
import jakarta.persistence.*;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
@Entity
@Table(name="team_ownership_transfers")
public class TeamOwnershipTransfer {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
  @Column(nullable=false)
  private Long teamId;
  @Column(nullable=false)
  private Long fromUserId;
  @Column(nullable=false)
  private Long toUserId;
  @Column(nullable=false,length=16)
  private String status;

  private Instant respondedAt;
  @CreationTimestamp @Column(nullable=false,updatable=false) private Instant createdAt;
  @UpdateTimestamp @Column(nullable=false) private Instant updatedAt;
  protected TeamOwnershipTransfer() {}
  public Long getId() { return id; }
  public Long getTeamId() { return teamId; }
  public Long getFromUserId() { return fromUserId; }
  public Long getToUserId() { return toUserId; }
  public String getStatus() { return status; }
  public Instant getRespondedAt() { return respondedAt; }
  public static TeamOwnershipTransfer request(long team,long from,long to) {
    var value=new TeamOwnershipTransfer(); value.teamId=team;value.fromUserId=from;value.toUserId=to;value.status="PENDING";return value;
  }
  public void respond(String status,Instant now) {this.status=status;this.respondedAt=now;}

}
