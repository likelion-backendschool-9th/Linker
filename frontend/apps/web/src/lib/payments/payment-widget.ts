import type { CheckoutOrder } from '@/features/subscription/subscription-api';
import { ApiError } from '@/lib/api/api-error';

export type WidgetTargets = { methods: string; agreement: string };
export type PaymentWidget = {
  requestPayment: () => Promise<string | void>;
  destroy: () => Promise<void>;
};
const unavailable = () =>
  new ApiError(503, {
    code: 'PAYMENT_UNAVAILABLE',
    message: '지금은 결제를 준비할 수 없어요. 잠시 후 다시 시도해 주세요.',
  });

/** Test-only provider boundary. Page code is identical for mock and Toss. */
export async function mountPaymentWidget(
  order: CheckoutOrder,
  targets: WidgetTargets,
  signal: AbortSignal,
): Promise<PaymentWidget> {
  if (process.env.NEXT_PUBLIC_USE_MOCKS === 'true') {
    const { mountMockPaymentWidget } = await import('@/mocks/mock-payment-widget');
    signal.throwIfAborted();
    return mountMockPaymentWidget(order, targets);
  }
  const key = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
  if (!key?.startsWith('test_')) throw unavailable();
  const { loadTossPayments } = await import('@tosspayments/tosspayments-sdk');
  signal.throwIfAborted();
  const toss = await loadTossPayments(key);
  signal.throwIfAborted();
  const widgets = toss.widgets({ customerKey: order.customerKey });
  await widgets.setAmount({ currency: 'KRW', value: order.amount });
  signal.throwIfAborted();
  const methods = await widgets.renderPaymentMethods({
    selector: targets.methods,
    variantKey: 'DEFAULT',
  });
  if (signal.aborted) {
    await methods.destroy();
    signal.throwIfAborted();
  }
  try {
    const agreement = await widgets.renderAgreement({
      selector: targets.agreement,
      variantKey: 'AGREEMENT',
    });
    const destroy = async () => {
      await Promise.all([methods.destroy(), agreement.destroy()]);
    };
    if (signal.aborted) {
      await destroy();
      signal.throwIfAborted();
    }
    return {
      requestPayment: async () => {
        signal.throwIfAborted();
        await widgets.requestPayment({
          orderId: order.orderId,
          orderName: order.orderName,
          successUrl: `${window.location.origin}/subscribe/success`,
          failUrl: `${window.location.origin}/subscribe/fail`,
        });
      },
      destroy,
    };
  } catch (error) {
    await methods.destroy();
    throw error;
  }
}
