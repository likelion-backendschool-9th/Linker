package com.linker.backend.entity.subscription;

import java.time.Instant;

import com.linker.backend.entity.subscription.type.BillingCycle;
import com.linker.backend.entity.subscription.type.PaymentStatus;
import com.linker.backend.entity.subscription.type.SubscriptionPlan;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * Toss Payments order and its result (ERD 3-9). The server creates the order (READY) with its own amount;
 * the browser success return is trusted only after the Toss confirm API answers DONE. Kept 5 years.
 * {@code plan}, {@code billingCycle}, {@code teamId} and {@code seats} snapshot the order before a
 * subscription row exists.
 */
@Entity
@Table(name = "payments")
public class Payment {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private Long subscriptionId;

	@Column(nullable = false)
	private Long payerUserId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private SubscriptionPlan plan;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private BillingCycle billingCycle;

	private Long teamId;

	private Integer seats;

	@Column(nullable = false, unique = true, length = 64)
	private String orderId;

	@Column(unique = true, length = 200)
	private String paymentKey;

	@Column(nullable = false, length = 100)
	private String orderName;

	@Column(nullable = false)
	private int amount;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 24)
	private PaymentStatus status;

	@Column(length = 32)
	private String method;

	private Instant approvedAt;

	private Instant canceledAt;

	@Column(length = 200)
	private String cancelReason;

	@Column(nullable = false)
	private int refundedAmount;

	@Column(length = 64)
	private String failureCode;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(columnDefinition = "jsonb")
	private String rawResponse;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected Payment() {
	}

	public static Payment order(long payerUserId, SubscriptionPlan plan, BillingCycle cycle, Long teamId,
			Integer seats, String orderId, String orderName, int amount) {
		Payment payment = new Payment();
		payment.payerUserId = payerUserId;
		payment.plan = plan;
		payment.billingCycle = cycle;
		payment.teamId = teamId;
		payment.seats = seats;
		payment.orderId = orderId;
		payment.orderName = orderName;
		payment.amount = amount;
		payment.status = PaymentStatus.READY;
		return payment;
	}

	/** The first confirm call binds the Toss paymentKey; a retry must send the same key. */
	public void claim(String paymentKey) {
		this.paymentKey = paymentKey;
	}

	public void approve(long subscriptionId, String method, Instant approvedAt, String rawResponse) {
		this.subscriptionId = subscriptionId;
		this.method = method;
		this.approvedAt = approvedAt;
		this.rawResponse = rawResponse;
		this.status = PaymentStatus.DONE;
		this.failureCode = null;
	}

	public void fail(String failureCode, String rawResponse) {
		this.status = PaymentStatus.FAILED;
		this.failureCode = failureCode;
		if (rawResponse != null) {
			this.rawResponse = rawResponse;
		}
	}

	public Long getId() {
		return id;
	}

	public Long getSubscriptionId() {
		return subscriptionId;
	}

	public Long getPayerUserId() {
		return payerUserId;
	}

	public SubscriptionPlan getPlan() {
		return plan;
	}

	public BillingCycle getBillingCycle() {
		return billingCycle;
	}

	public Long getTeamId() {
		return teamId;
	}

	public Integer getSeats() {
		return seats;
	}

	public String getOrderId() {
		return orderId;
	}

	public String getPaymentKey() {
		return paymentKey;
	}

	public String getOrderName() {
		return orderName;
	}

	public int getAmount() {
		return amount;
	}

	public PaymentStatus getStatus() {
		return status;
	}

	public String getMethod() {
		return method;
	}

	public Instant getApprovedAt() {
		return approvedAt;
	}

	public Instant getCanceledAt() {
		return canceledAt;
	}

	public String getCancelReason() {
		return cancelReason;
	}

	public int getRefundedAmount() {
		return refundedAmount;
	}

	public String getFailureCode() {
		return failureCode;
	}

	public String getRawResponse() {
		return rawResponse;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
