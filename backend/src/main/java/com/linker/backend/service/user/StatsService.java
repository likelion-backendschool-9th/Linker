package com.linker.backend.service.user;

import com.linker.backend.dto.stats.response.*;
import com.linker.backend.entity.account.type.*;
import com.linker.backend.entity.post.type.PostViewSource;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.post.*;
import com.linker.backend.repository.profile.ProfileVisitRepository;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service("userStatsService")
@Transactional(propagation=Propagation.NEVER)
public class StatsService {
  private final UserRepository users;
  private final PostRepository posts;
  private final PostViewRepository views;
  private final ProfileVisitRepository visits;
  private final ProMembership pro;
  private final Clock clock;
  private final TransactionTemplate read;
  public StatsService(UserRepository users,PostRepository posts,PostViewRepository views,
      ProfileVisitRepository visits,ProMembership pro,Clock clock,PlatformTransactionManager tx) {
    this.users=users;this.posts=posts;this.views=views;this.visits=visits;this.pro=pro;this.clock=clock;
    this.read=new TransactionTemplate(tx);this.read.setReadOnly(true);
  }
  public StatsSummaryResponse summary(AuthenticatedUser actor) {
    long userId=requireDeveloper(actor);
    boolean isPro=pro.active(userId,clock.instant());
    return read.execute(tx -> new StatsSummaryResponse(posts.findOwnStatsPosts(userId).stream()
        .map(p -> new StatsSummaryResponse.Item(p.getId(),p.getSummary(),p.getLikeCount(),p.getCommentCount(),p.getViewCount())).toList(),isPro));
  }
  public RecruiterViewsResponse recruiterViews(AuthenticatedUser actor,int weeks) {
    long userId=requireDeveloper(actor);requirePro(userId);
    if (weeks<1 || weeks>PlanLimits.STATS_RECRUITER_WEEKS) throw invalid();
    LocalDate today=clock.instant().atZone(PlanLimits.APP_ZONE).toLocalDate();
    LocalDate monday=today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    return read.execute(tx -> {
      List<RecruiterViewsResponse.Week> result=new ArrayList<>();
      for (int i=weeks-1;i>=0;i--) {
        LocalDate start=monday.minusWeeks(i),end=i==0?today:start.plusDays(6);
        result.add(new RecruiterViewsResponse.Week(start,visits.countOwnDistinctRecruiters(userId,start,end)));
      }
      return new RecruiterViewsResponse(result.getLast().count(),List.copyOf(result));
    });
  }
  public PostStatsResponse postStats(AuthenticatedUser actor,int days) {
    long userId=requireDeveloper(actor);requirePro(userId);
    if (days<1 || days>PlanLimits.STATS_TREND_DAYS) throw invalid();
    LocalDate today=clock.instant().atZone(PlanLimits.APP_ZONE).toLocalDate(),start=today.minusDays(days-1);
    return read.execute(tx -> {
      Map<Long,List<PostViewBucket>> grouped=views.findStatsBuckets(userId,start,today).stream()
          .collect(Collectors.groupingBy(PostViewBucket::postId));
      var result=posts.findOwnStatsPosts(userId).stream().map(p -> {
        var buckets=grouped.getOrDefault(p.getId(),List.of());
        List<PostStatsResponse.Source> sources=new ArrayList<>();
        for (var source:PostViewSource.values()) sources.add(new PostStatsResponse.Source(source.name(),
            buckets.stream().filter(b -> b.source()==source).mapToLong(PostViewBucket::views).sum()));
        Map<LocalDate,Long> daily=new HashMap<>();
        for (var b:buckets) daily.merge(b.day(),b.views(),Long::sum);
        var trend=start.datesUntil(today.plusDays(1)).map(d -> new PostStatsResponse.Day(d,daily.getOrDefault(d,0L))).toList();
        return new PostStatsResponse.Item(p.getId(),p.getSummary(),List.copyOf(sources),
            buckets.stream().mapToLong(PostViewBucket::readmeExpands).sum(),trend);
      }).toList();
      return new PostStatsResponse(result);
    });
  }
  private long requireDeveloper(AuthenticatedUser actor) {
    if (actor==null) throw new ApiException(401,"LOGIN_REQUIRED","로그인이 필요해요");
    var user=users.findById(actor.userId()).filter(u -> u.getDeletedAt()==null
        && (u.getStatus()==UserStatus.ACTIVE || u.getStatus()==UserStatus.SUSPENDED))
        .orElseThrow(() -> new ApiException(403,"FORBIDDEN","통계는 본인만 볼 수 있어요"));
    if (user.getUserType()!=UserType.DEVELOPER) throw new ApiException(403,"DEVELOPER_ONLY","개발자만 사용할 수 있어요");
    return user.getId();
  }
  private void requirePro(long userId) {
    if (!pro.active(userId,clock.instant())) throw new ApiException(403,"PLAN_LIMIT",
        "Pro에서 유입 경로, 최근 "+PlanLimits.STATS_TREND_DAYS+"일 추이와 채용 담당자 조회 수를 확인해요.",Map.of("reason","stats"));
  }
  private static ApiException invalid() { return new ApiException(400,"VALIDATION_ERROR","통계 조회 기간을 확인해 주세요"); }
}
