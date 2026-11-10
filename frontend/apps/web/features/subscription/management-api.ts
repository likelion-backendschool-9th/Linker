import {
  cancelSubscription as cancelSubscriptionApi,
  getListMyPaymentsQueryOptions,
  getListMySubscriptionsQueryOptions,
  refundPayment as refundPaymentApi,
} from '@linker/api/p29-subscription-manage/p29-subscription-manage';
import type {
  PaymentItemResponse,
  SubscriptionItemResponse,
} from '@linker/api/openAPIDefinition.schemas';

import { subscriptionKeys } from './subscription-api';

/**
 * Running subscriptions only (expired and refunded ones leave the list). A canceled one stays
 * `status: ACTIVE` with `cancelAtPeriodEnd: true` until `expiresOn`.
 */
export type Subscription = SubscriptionItemResponse;
/** `status`: DONE (paid), CANCELED (refunded) or PARTIAL_CANCELED. */
export type Payment = PaymentItemResponse;

export function subscriptionsOptions(login: string | null) {
  return getListMySubscriptionsQueryOptions({
    query: {
      queryKey: [...subscriptionKeys.account(login), 'management'],
      refetchOnMount: 'always',
    },
    request: { cache: 'no-store' },
  });
}

/** First page (20, newest first). MVP accounts stay well under one page. */
export function paymentsOptions(login: string | null) {
  return getListMyPaymentsQueryOptions(undefined, {
    query: {
      queryKey: [...subscriptionKeys.account(login), 'payments'],
      refetchOnMount: 'always',
    },
    request: { cache: 'no-store' },
  });
}

export function cancelSubscription(subscriptionId: number) {
  return cancelSubscriptionApi(subscriptionId);
}

export function refundPayment(paymentId: number) {
  return refundPaymentApi(paymentId);
}
