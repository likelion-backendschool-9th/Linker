package com.linker.backend.global.security;

import com.linker.backend.dto.moderation.request.DailyLimitRejected;
import com.linker.backend.dto.moderation.request.DailyLimitRejected.Category;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import org.aspectj.lang.annotation.*;
import org.slf4j.*;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/** Observes existing denials without changing D's rate limits, responses or service implementations. */
@Aspect
@Component
public class DailyLimitReviewObserver {
  private static final Logger log=LoggerFactory.getLogger(DailyLimitReviewObserver.class);
  private final ApplicationEventPublisher events;
  private final java.time.Clock clock;
  public DailyLimitReviewObserver(ApplicationEventPublisher events,java.time.Clock clock) {this.events=events;this.clock=clock;}
  @AfterReturning(pointcut="execution(* com.linker.backend.global.security.RedisRateLimiter.tryAcquire(..)) && args(bucket,userId,permits,windowSeconds)", returning="decision")
  public void rate(String bucket,long userId,int permits,int windowSeconds,RedisRateLimiter.Decision decision) {
    if(decision!=null && bucket!=null && !decision.allowed() && bucket.startsWith("chat.share.day:"))
      publish(new DailyLimitRejected(userId,Category.CHAT_SHARE,permits,clock.instant()));
  }
  @AfterThrowing(pointcut="execution(* com.linker.backend.service.user.AiSummaryService.create(..)) && args(user,roomId)",throwing="exception")
  public void ai(AuthenticatedUser user,long roomId,ApiException exception) {
    // create() has exactly one RATE_LIMITED outcome: its daily quota reservation.
    if(user!=null && exception.getStatus()==429 && "RATE_LIMITED".equals(exception.getCode()))
      publish(new DailyLimitRejected(user.userId(),Category.AI_SUMMARY,PlanLimits.AI_SUMMARY_PER_DAY_FLEX,clock.instant()));
  }
  private void publish(DailyLimitRejected event) {
    try {events.publishEvent(event);}
    catch(RuntimeException failure) {log.warn("review counter unavailable: {}",failure.getClass().getSimpleName());}
  }
}
