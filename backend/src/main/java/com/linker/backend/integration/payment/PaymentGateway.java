package com.linker.backend.integration.payment;

/**
 * Toss Payments (and future providers) boundary. Subscription/Payment services call this after
 * local order checks; never trust the browser success callback alone.
 */
public interface PaymentGateway {

	PaymentConfirmResult confirm(PaymentConfirmCommand command);

	PaymentCancelResult cancel(PaymentCancelCommand command);
}
