import { paymentCallbackUrl, withPaymentReturnTo } from './payment-return';

it('leaves the default destination off the callback URL', () => {
  expect(withPaymentReturnTo('/subscribe/success?orderId=1', null)).toBe(
    '/subscribe/success?orderId=1',
  );
  expect(withPaymentReturnTo('/subscribe', '/feed')).toBe('/subscribe');
  expect(paymentCallbackUrl('fail', 'http://localhost:3000', '//evil.example')).toBe(
    'http://localhost:3000/subscribe/fail',
  );
});

it('carries a safe return path through success and retry URLs', () => {
  expect(withPaymentReturnTo('/subscribe/success?orderId=1', '/me/stats')).toBe(
    '/subscribe/success?orderId=1&returnTo=%2Fme%2Fstats',
  );
  expect(paymentCallbackUrl('success', 'http://localhost:3000', '/teams/3/settings')).toBe(
    'http://localhost:3000/subscribe/success?returnTo=%2Fteams%2F3%2Fsettings',
  );
});
