import { mountPaymentWidget } from './payment-widget';

const order = {
  orderId: 'order-1',
  amount: 2900,
  customerKey: 'customer-1',
  orderName: 'Pro',
  planKey: 'PRO' as const,
  billing: 'MONTHLY' as const,
  teamId: null,
};
afterEach(() => vi.unstubAllEnvs());
it.each(['', 'live_key'])(
  'rejects non-test widget configuration before loading Toss: %s',
  async (key) => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'false');
    vi.stubEnv('NEXT_PUBLIC_TOSS_CLIENT_KEY', key);
    await expect(
      mountPaymentWidget(
        order,
        { methods: '#methods', agreement: '#agreement' },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: 'PAYMENT_UNAVAILABLE' });
  },
);
