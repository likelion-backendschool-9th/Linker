import type { CheckoutOrder } from '@/features/subscription/subscription-api';
import type { PaymentWidget, WidgetTargets } from '@/lib/payments/payment-widget';
import { withPaymentReturnTo } from '@/lib/payments/payment-return';
import { ApiError } from '@/lib/api/api-error';

/** Deliberately labelled mock controls: never contacts Toss or collects card details. */
export function mountMockPaymentWidget(
  order: CheckoutOrder,
  targets: WidgetTargets,
  returnTo?: string | null,
): PaymentWidget {
  const methods = document.querySelector(targets.methods);
  const agreement = document.querySelector(targets.agreement);
  if (!methods || !agreement) throw new Error('Missing payment widget target');
  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = '목업 결제 결과';
  fieldset.append(legend);
  const hint = document.createElement('p');
  hint.textContent = '목업 결제 화면입니다. Toss와 연결되지 않아요.';
  fieldset.append(hint);
  let declined = false;
  for (const [value, text] of [
    ['success', '결제 성공'],
    ['fail', '결제 실패'],
  ] as const) {
    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = `payment-outcome-${order.orderId}`;
    radio.value = value;
    radio.checked = value === 'success';
    radio.addEventListener('change', () => {
      if (radio.checked) declined = value === 'fail';
    });
    label.append(radio, document.createTextNode(text));
    fieldset.append(label);
  }
  const label = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  label.append(checkbox, document.createTextNode('결제에 동의해요'));
  methods.replaceChildren(fieldset);
  agreement.replaceChildren(label);
  return {
    requestPayment: async () => {
      if (!checkbox.checked)
        throw new ApiError(400, { code: 'AGREEMENT_REQUIRED', message: '결제에 동의해 주세요.' });
      const query = new URLSearchParams({ orderId: order.orderId });
      if (declined) {
        query.set('code', 'MOCK_DECLINED');
        query.set('message', '테스트 결제를 완료하지 못했어요.');
        return withPaymentReturnTo(`/subscribe/fail?${query}`, returnTo);
      }
      query.set('paymentKey', `mock_${order.orderId}`);
      query.set('amount', String(order.amount));
      return withPaymentReturnTo(`/subscribe/success?${query}`, returnTo);
    },
    destroy: async () => {
      fieldset.remove();
      label.remove();
    },
  };
}
