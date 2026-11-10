/** 29 Manage subscription: `SubscriptionController` */

import { get, post, type MockRoute } from '../core/define';
import { cancel, liveSubscriptions, paymentView, refund, state } from '../fixtures/subscriptions';

export const routes: MockRoute[] = [
  get('/api/v1/user/me/subscriptions', ({ viewer }) => ({ items: liveSubscriptions(viewer) })),
  get('/api/v1/user/me/payments', ({ viewer }) => {
    const data = state(viewer);
    return { items: data.payments.map((item) => paymentView(data, item)), nextCursor: null };
  }),
  post('/api/v1/user/me/subscriptions/:subscriptionId/cancel', ({ params, viewer }) =>
    cancel(viewer, Number(params.subscriptionId)),
  ),
  post('/api/v1/user/me/payments/:paymentId/refund', ({ params, viewer }) =>
    refund(viewer, Number(params.paymentId)),
  ),
];
