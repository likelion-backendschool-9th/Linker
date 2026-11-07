package com.linker.backend.dto.moderation.response;

import java.time.Instant;
import java.util.List;

public record AdminUsersResponse(List<Item> items, String nextCursor, boolean reviewFilterSupported) {
  public record Item(long id, String login, String name, String avatarUrl, String userType,
      String emailMasked, String status, Boolean needsReview, Instant joinedAt) {}
  public record SanctionView(long id, String step, String reason, String reasonCode,
      Instant startsAt, Instant endsAt, Instant revokedAt, boolean active) {}
  public record ReportView(long caseId, String targetType, String result, Instant at) {}
  public record SubscriptionView(long id, String plan, String status, Long teamId, Instant periodEnd) {}
  public record PaymentView(long id, int amount, String status, Instant paidAt, int refundedAmount) {}
  public record RecruiterView(String company, String domain, String jobTitle,
      long offersSent30d, long offersAccepted30d) {}
  public record Actions(boolean permanentSanction, boolean liftSanction, boolean refund) {}
  public record Detail(long id, String login, String name, String avatarUrl, String userType,
      String emailMasked, String status, Instant joinedAt, Actions allowedActions,
      List<SanctionView> sanctions, List<ReportView> reportHistory,
      List<SubscriptionView> subscriptions, List<PaymentView> payments, RecruiterView recruiter) {}
  public record RevealedEmail(String email) {}
}
