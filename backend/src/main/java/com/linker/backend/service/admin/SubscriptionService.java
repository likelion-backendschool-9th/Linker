package com.linker.backend.service.admin;

import com.linker.backend.dto.subscription.response.AdminRefundResponse;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.moderation.*;
import com.linker.backend.entity.moderation.type.AdminActionType;
import com.linker.backend.entity.subscription.*;
import com.linker.backend.entity.subscription.type.*;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.payment.*;
import com.linker.backend.repository.moderation.*;
import com.linker.backend.repository.subscription.*;
import java.time.*;
import java.util.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.ObjectMapper;

/** Operator implementation of the same Policy refund rules; no cross-role business service calls. */
@Service("adminSubscriptionService")
@Transactional(propagation=Propagation.NEVER)
public class SubscriptionService {
  // Match D's body and idempotency key so user/operator retries address the same Toss cancellation.
  private static final String REFUND_REASON="7일 이내 혜택 시작 전 환불";
  private final AdminRepository admins;
  private final AdminActionRepository actions;
  private final PaymentRepository payments;
  private final SubscriptionRepository subscriptions;
  private final PaymentGateway gateway;
  private final Clock clock;
  private final ObjectMapper json;
  private final TransactionTemplate write;
  public SubscriptionService(AdminRepository admins,AdminActionRepository actions,PaymentRepository payments,
      SubscriptionRepository subscriptions,PaymentGateway gateway,Clock clock,ObjectMapper json,PlatformTransactionManager tx) {
    this.admins=admins;this.actions=actions;this.payments=payments;this.subscriptions=subscriptions;
    this.gateway=gateway;this.clock=clock;this.json=json;this.write=new TransactionTemplate(tx);
  }
  public AdminRefundResponse refund(AuthenticatedUser actor,long id) {
    Claim claim=write.execute(tx -> {
      Admin admin=admins.findByUser_Id(actor.userId()).filter(a -> actor.operatorAuthorized()
          && a.getUser().getStatus()==UserStatus.ACTIVE && a.getUser().getDeletedAt()==null)
          .orElseThrow(() -> new ApiException(403,"FORBIDDEN","운영자만 쓸 수 있어요"));
      if (!actions.supportsRefundAudit()) throw new ApiException(503,"SERVICE_UNAVAILABLE","환불 감사 마이그레이션 합의와 적용이 필요해요");
      Payment p=payment(id);
      if (p.getStatus()==PaymentStatus.CANCELED) return new Claim(admin.getId(),null,null,0,result(p));
      if (p.getStatus()!=PaymentStatus.DONE) throw new ApiException(409,"NOT_REFUNDABLE","환불할 수 없는 결제예요.");
      Instant now=clock.instant();
      if (p.getApprovedAt()==null || !p.getApprovedAt().plus(Duration.ofDays(PlanLimits.PAYMENT_REFUND_WITHIN_DAYS)).isAfter(now))
        throw new ApiException(409,"REFUND_PERIOD_OVER","결제 후 7일이 지나 환불할 수 없어요.");
      Subscription s=subscriptions.findById(p.getSubscriptionId()).orElseThrow(SubscriptionService::used);
      if (!SubscriptionStatus.LIVE.contains(s.getStatus()) || !s.getCurrentPeriodEnd().isAfter(now)) throw used();
      var paid=payments.findPaidNewestFirst(s.getId(),PaymentStatus.DONE,PageRequest.of(0,1));
      if (paid.isEmpty() || !paid.getFirst().getId().equals(p.getId()))
        throw new ApiException(409,"REFUND_NOT_LATEST","가장 최근 결제부터 환불할 수 있어요.");
      if (!s.getCurrentPeriodStart().isAfter(now)) throw used();
      return new Claim(admin.getId(),p.getPaymentKey(),p.getOrderId(),p.getAmount(),null);
    });
    if (claim.done()!=null) return claim.done();
    PaymentCancelResult result;
    try { result=gateway.cancel(new PaymentCancelCommand(claim.key(),REFUND_REASON,null,"cancel:"+claim.order())); }
    catch (PaymentGatewayException e) {
      if ("ALREADY_CANCELED_PAYMENT".equals(e.code())) result=null;
      else if ("IDEMPOTENT_REQUEST_PROCESSING".equals(e.code()))
        throw new ApiException(409,"PAYMENT_PROCESSING","환불을 처리하고 있어요. 잠시 후 다시 확인해 주세요.");
      else throw new ApiException(502,"PAYMENT_GATEWAY_ERROR","환불 결과를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    catch (RestClientException e) { throw new ApiException(502,"PAYMENT_GATEWAY_ERROR","환불 결과를 확인하지 못했어요. 잠시 후 다시 시도해 주세요."); }
    if (result!=null && (!"CANCELED".equals(result.status()) || result.cancelAmount()!=claim.amount()
        || !claim.key().equals(result.paymentKey()) || !claim.order().equals(result.orderId())))
      throw new ApiException(502,"PAYMENT_GATEWAY_ERROR","환불 결과를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
    PaymentCancelResult canceled=result;
    return write.execute(tx -> {
      Payment p=payment(id);
      if (p.getStatus()==PaymentStatus.CANCELED) return result(p);
      boolean team=p.getPlan()==SubscriptionPlan.FLEX;
      subscriptions.lockTarget((team?"team:":"user:")+(team?p.getTeamId():p.getPayerUserId()));
      Subscription s=subscriptions.lockById(p.getSubscriptionId()).orElseThrow();
      Instant now=clock.instant();
      var paid=payments.findPaidNewestFirst(s.getId(),PaymentStatus.DONE,PageRequest.of(0,2));
      if (!paid.isEmpty() && paid.getFirst().getId().equals(p.getId())) {
        Instant end=s.getCurrentPeriodStart();
        if (paid.size()>1 && end.isAfter(now)) {
          Payment previous=paid.get(1);
          s.revokePeriod(previous.getBillingCycle(),previous.getSeats(),start(end,previous.getBillingCycle()),end);
        } else s.endNow(now);
      } else {
        Instant end=start(s.getCurrentPeriodEnd(),p.getBillingCycle());
        if (end.isAfter(now)) s.revokePeriod(s.getBillingCycle(),null,
            s.getCurrentPeriodStart().isBefore(end)?s.getCurrentPeriodStart():start(end,s.getBillingCycle()),end);
        else s.endNow(now);
      }
      Instant when=now;
      if (canceled!=null && canceled.canceledAt()!=null) {
        try { when=OffsetDateTime.parse(canceled.canceledAt()).toInstant(); } catch (java.time.format.DateTimeParseException ignored) {}
      }
      p.refund(when,REFUND_REASON,canceled==null?null:json.writeValueAsString(canceled.rawResponse()));
      actions.save(AdminAction.record(admins.getReferenceById(claim.adminId()),AdminActionType.REFUND,"PAYMENT",id,null,
          REFUND_REASON,json.writeValueAsString(Map.of("subscriptionId",s.getId(),"amount",p.getAmount()))));
      return result(p);
    });
  }
  private Payment payment(long id) { return payments.lockById(id).orElseThrow(() -> new ApiException(404,"PAYMENT_NOT_FOUND","결제 내역을 찾지 못했어요.")); }
  private static Instant start(Instant end,BillingCycle cycle) {
    var local=end.atZone(PlanLimits.APP_ZONE);return (cycle==BillingCycle.YEARLY?local.minusYears(1):local.minusMonths(1)).toInstant();
  }
  private static AdminRefundResponse result(Payment p) { return new AdminRefundResponse(p.getId(),p.getStatus().name(),p.getRefundedAmount(),p.getStatus()==PaymentStatus.CANCELED); }
  private static ApiException used() { return new ApiException(409,"REFUND_BENEFITS_USED","이미 혜택이 시작된 결제는 환불할 수 없어요. 해지하면 남은 기간까지 쓸 수 있어요."); }
  private record Claim(long adminId,String key,String order,int amount,AdminRefundResponse done) {}
}
