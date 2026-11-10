package com.linker.backend.dto.moderation.request;

/** Internal observation contract. Producers provide the actual rejected daily allowance. */
public record DailyLimitRejected(long userId, Category category, int limit, java.time.Instant occurredAt) {
  public enum Category { RECRUITING_OFFER, AI_SUMMARY, CHAT_SHARE }
}
