package com.linker.backend.repository.moderation;

import java.time.*;
import java.util.*;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Repository;

/** Ephemeral Redis counters, not relational entities. Lua makes threshold/expiry changes atomic. */
@Repository
public class DailyLimitReviewRepository {
  private static final DefaultRedisScript<Long> RECORD = new DefaultRedisScript<>("""
      local n = redis.call('INCR', KEYS[1])
      redis.call('EXPIRE', KEYS[1], ARGV[1])
      if n > tonumber(ARGV[2]) then
        redis.call('SADD', KEYS[2], ARGV[3])
        redis.call('EXPIRE', KEYS[2], ARGV[1])
      end
      return n
      """, Long.class);
  private final StringRedisTemplate redis;
  public DailyLimitReviewRepository(StringRedisTemplate redis) {this.redis=redis;}
  public void record(long userId,String category,LocalDate day,int threshold,Duration ttl) {
    String base="admin-review:"+day;
    redis.execute(RECORD,List.of(base+":"+category+":"+userId,base+":users"),
        Long.toString(Math.max(1,ttl.toSeconds())),Integer.toString(threshold),Long.toString(userId));
  }
  public Set<Long> flagged(LocalDate day) {
    Set<String> values=redis.opsForSet().members("admin-review:"+day+":users");
    if(values==null) return Set.of();
    Set<Long> result=new HashSet<>();
    for(String value:values) result.add(Long.valueOf(value));
    return Set.copyOf(result);
  }
}
