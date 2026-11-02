import { fail, get, post, type MockRoute } from '../core/define';
import { toKstIso } from '@/lib/format/time';
import { readOrders, saveOrder } from '../fixtures/payment-orders';
import { state, save, paymentView } from '../fixtures/subscriptions';

export const routes: MockRoute[] = [
  get('/api/v1/user/me/subscriptions', ({ viewer }) => ({ items: state(viewer).subscriptions })),
  get('/api/v1/user/me/payments', ({ viewer }) => ({
    items: state(viewer).payments.map(paymentView),
  })),
  post('/api/v1/user/me/subscriptions/:subscriptionId/cancel', ({ params, viewer }) => {
    const data = state(viewer);
    const sub = data.subscriptions.find((item) => item.id === params.subscriptionId);
    if (!sub) fail(404, 'NOT_FOUND', '구독을 찾지 못했어요.');
    if (!sub.billingOwner) fail(403, 'BILLING_OWNER_ONLY', '결제 담당자만 해지할 수 있어요.');
    if (sub.status === 'ENDED') fail(409, 'SUBSCRIPTION_ENDED', '이미 종료된 구독이에요.');
    if (sub.status === 'ACTIVE') {
      sub.endsOn = sub.nextBillingDate;
      sub.nextBillingDate = null;
      sub.status = 'CANCELING';
    }
    save(viewer, data);
    return sub;
  }),
  post('/api/v1/user/me/payments/:paymentId/refund', ({ params, viewer }) => {
    const data = state(viewer);
    const payment = data.payments.find((item) => item.id === params.paymentId);
    if (!payment) fail(404, 'NOT_FOUND', '결제 내역을 찾지 못했어요.');
    if (payment.status === 'REFUNDED') return paymentView(payment);
    if (!paymentView(payment).refundable)
      fail(409, 'REFUND_NOT_ALLOWED', paymentView(payment).refundReason!);
    payment.status = 'REFUNDED';
    const sub = data.subscriptions.find((item) => item.id === payment.subscriptionId)!;
    sub.status = 'ENDED';
    sub.nextBillingDate = null;
    sub.endsOn = toKstIso(new Date()).slice(0, 10);
    const order = readOrders(viewer).find((item) => item.orderId === payment.id);
    if (order) {
      order.state = 'REFUNDED';
      saveOrder(order);
    }
    save(viewer, data);
    return paymentView(payment);
  }),
  post(
    '/api/v1/user/me/subscriptions/:subscriptionId/billing-owner',
    () => fail(501, 'NOT_IMPLEMENTED', '결제 담당자 변경은 준비 중이에요.'),
    { only: 'developer' },
  ),
];
