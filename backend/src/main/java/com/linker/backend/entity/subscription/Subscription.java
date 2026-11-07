package com.linker.backend.entity.subscription;

import java.time.Instant;

import com.linker.backend.entity.subscription.type.BillingCycle;
import com.linker.backend.entity.subscription.type.SubscriptionPlan;
import com.linker.backend.entity.subscription.type.SubscriptionStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * Pro / Scout (user) or Flex (team) subscription (ERD 3-9). Benefits follow {@code current_period_end}.
 * The first stage is one-time payment + period end: trial, grace and billing-key columns stay unset.
 */
@Entity
@Table(name = "subscriptions")
public class Subscription {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private SubscriptionPlan plan;

	private Long userId;

	private Long teamId;

	@Column(nullable = false)
	private Long payerUserId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private BillingCycle billingCycle;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private SubscriptionStatus status;

	private Integer seats;

	@Column(name = "is_trial", nullable = false)
	private boolean trial;

	private Instant trialEndsAt;

	@Column(nullable = false)
	private Instant currentPeriodStart;

	@Column(nullable = false)
	private Instant currentPeriodEnd;

	@Column(nullable = false)
	private boolean cancelAtPeriodEnd;

	private Instant canceledAt;

	private Instant graceUntil;

	private Instant graceEndsAt;

	@Column(columnDefinition = "text")
	private String billingKeyEnc;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected Subscription() {
	}

	/** First paid period. PRO/SCOUT fill {@code userId}; FLEX fills {@code teamId} and {@code seats}. */
	public static Subscription paid(SubscriptionPlan plan, Long userId, Long teamId, long payerUserId,
			BillingCycle cycle, Integer seats, Instant start, Instant end) {
		Subscription subscription = new Subscription();
		subscription.plan = plan;
		subscription.userId = userId;
		subscription.teamId = teamId;
		subscription.payerUserId = payerUserId;
		subscription.billingCycle = cycle;
		subscription.seats = seats;
		subscription.status = SubscriptionStatus.ACTIVE;
		subscription.currentPeriodStart = start;
		subscription.currentPeriodEnd = end;
		return subscription;
	}

	/**
	 * Another one-time payment on the live row. The new period starts at {@code start} (the old end,
	 * or now once it has lapsed) and a scheduled cancel is undone because the user paid again.
	 * Flex seats take the headcount of this billing date; the billing owner stays as it is.
	 */
	public void extend(BillingCycle cycle, Integer seats, Instant start, Instant end) {
		this.billingCycle = cycle;
		if (seats != null) {
			this.seats = seats;
		}
		this.status = SubscriptionStatus.ACTIVE;
		this.currentPeriodStart = start;
		this.currentPeriodEnd = end;
		this.cancelAtPeriodEnd = false;
		this.canceledAt = null;
		this.graceUntil = null;
	}

	public Long getId() {
		return id;
	}

	public SubscriptionPlan getPlan() {
		return plan;
	}

	public Long getUserId() {
		return userId;
	}

	public Long getTeamId() {
		return teamId;
	}

	public Long getPayerUserId() {
		return payerUserId;
	}

	public BillingCycle getBillingCycle() {
		return billingCycle;
	}

	public SubscriptionStatus getStatus() {
		return status;
	}

	public Integer getSeats() {
		return seats;
	}

	public boolean isTrial() {
		return trial;
	}

	public Instant getTrialEndsAt() {
		return trialEndsAt;
	}

	public Instant getCurrentPeriodStart() {
		return currentPeriodStart;
	}

	public Instant getCurrentPeriodEnd() {
		return currentPeriodEnd;
	}

	public boolean isCancelAtPeriodEnd() {
		return cancelAtPeriodEnd;
	}

	public Instant getCanceledAt() {
		return canceledAt;
	}

	public Instant getGraceUntil() {
		return graceUntil;
	}

	public Instant getGraceEndsAt() {
		return graceEndsAt;
	}

	public String getBillingKeyEnc() {
		return billingKeyEnc;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
