package com.linker.backend.dto.moderation.response;

import java.time.Instant;
import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

public record AdminUsersResponse(List<Item> items, String nextCursor, boolean reviewFilterSupported) {
  @Schema(name="AdminUserListItem")
  public record Item(long id, String login, String name, String avatarUrl, String userType,
      String emailMasked, String status, @Schema(nullable=true) Boolean needsReview, Instant joinedAt) {}
  @Schema(name="AdminUserSanction")
  public record SanctionView(long id, String step, String reason, String reasonCode,
      Instant startsAt, Instant endsAt, Instant revokedAt, boolean active) {}
  @Schema(name="AdminUserReport")
  public record ReportView(long caseId, String targetType, String result, Instant at) {}
  @Schema(name="AdminUserSubscription")
  public record SubscriptionView(long id, String plan, String status, Long teamId, Instant periodEnd) {}
  @Schema(name="AdminUserPayment")
  public record PaymentView(long id, int amount, String status, Instant paidAt, int refundedAmount) {}
  @Schema(name="AdminUserRecruiter")
  public record RecruiterView(String company, String domain, String jobTitle,
      long offersSent30d, long offersAccepted30d) {}
  @Schema(name="AdminUserAllowedActions")
  public record Actions(boolean permanentSanction, boolean liftSanction, boolean refund) {}
  @Schema(name="AdminUserDetail")
  public record Detail(long id, String login, String name, String avatarUrl, String userType,
      String emailMasked, String status, Instant joinedAt, Actions allowedActions,
      List<SanctionView> sanctions, List<ReportView> reportHistory,
      List<SubscriptionView> subscriptions, List<PaymentView> payments, RecruiterView recruiter) {}
  @Schema(name="AdminUserRevealedEmail")
  public record RevealedEmail(String email) {}
}
