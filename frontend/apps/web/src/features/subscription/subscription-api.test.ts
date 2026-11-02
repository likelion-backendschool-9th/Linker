import { parsePaymentReturn } from './subscription-api';

it.each(['', '0', '-1', '1.5', 'NaN', '9007199254740992'])(
  'rejects malformed payment amounts: %s',
  (amount) => {
    expect(parsePaymentReturn({ orderId: 'order-1', paymentKey: 'key', amount })).toBeNull();
  },
);
it('requires all provider callback fields, without treating the URL as approval', () => {
  expect(parsePaymentReturn({ orderId: 'order-1', amount: '2900' })).toBeNull();
  expect(parsePaymentReturn({ orderId: 'order-1', paymentKey: 'key', amount: '2900' })).toEqual({
    orderId: 'order-1',
    paymentKey: 'key',
    amount: 2900,
  });
});
