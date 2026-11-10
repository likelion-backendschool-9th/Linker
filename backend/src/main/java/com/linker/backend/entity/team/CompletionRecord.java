package com.linker.backend.entity.team;
import jakarta.persistence.*;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
@Entity
@Table(name="completion_records")
public class CompletionRecord {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
  @Column(nullable=false)
  private Long completionId;
  @Column(nullable=false)
  private Long userId;
  @Column(nullable=false,length=16)
  private String result;
  @Column(nullable=false)
  private int assignedIssueCount;
  @Column(nullable=false)
  private int doneIssueCount;
  @CreationTimestamp @Column(nullable=false,updatable=false) private Instant createdAt;
  @UpdateTimestamp @Column(nullable=false) private Instant updatedAt;
  protected CompletionRecord() {}
  public Long getId() { return id; }
  public Long getCompletionId() { return completionId; }
  public Long getUserId() { return userId; }
  public String getResult() { return result; }
  public int getAssignedIssueCount() { return assignedIssueCount; }
  public int getDoneIssueCount() { return doneIssueCount; }
  public static CompletionRecord record(long completion,long user,String result,int assigned,int done) {
    var value=new CompletionRecord();value.completionId=completion;value.userId=user;value.result=result;
    value.assignedIssueCount=assigned;value.doneIssueCount=done;return value;
  }

}
