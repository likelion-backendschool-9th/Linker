package com.linker.backend.global.security;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.*;
import com.linker.backend.entity.account.type.*;
import com.linker.backend.global.error.ApiException;
import java.time.*;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

class DailyLimitReviewObserverTest {
  private final AuthenticatedUser user=new AuthenticatedUser(1,"user",UserType.DEVELOPER,UserStatus.ACTIVE,null,false,false,true,1);
  @Test void collectionFailureNeverReplacesTheOriginalQuotaError() {
    ApplicationEventPublisher events=event -> {throw new IllegalStateException("Redis unavailable");};
    var observer=new DailyLimitReviewObserver(events,Clock.systemUTC());
    assertThatCode(() -> observer.ai(user,1,new ApiException(429,"RATE_LIMITED","daily quota"))).doesNotThrowAnyException();
    assertThatCode(() -> observer.rate("chat.share.day:2026-11-11",1,100,1000,new RedisRateLimiter.Decision(false,1000))).doesNotThrowAnyException();
  }
  @Test void planDenialsAndSuccessfulOrMinuteLimitedRequestsAreNotAbuseCounts() {
    var events=mock(ApplicationEventPublisher.class);
    var observer=new DailyLimitReviewObserver(events,Clock.systemUTC());
    observer.ai(user,1,new ApiException(403,"PLAN_LIMIT","Flex required"));
    observer.rate("chat.share",1,10,60,new RedisRateLimiter.Decision(false,60));
    observer.rate("chat.share.day:2026-11-11",1,100,1000,new RedisRateLimiter.Decision(true,0));
    observer.rate(null,1,100,1000,null);
    verifyNoInteractions(events);
  }
}
