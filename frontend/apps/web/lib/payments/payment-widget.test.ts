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

it('mounts the mock widget under NEXT_PUBLIC_USE_MOCKS', async () => {
  vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'true');
  document.body.innerHTML = '<div id="methods"></div><div id="agreement"></div>';
  const widget = await mountPaymentWidget(
    order,
    { methods: '#methods', agreement: '#agreement' },
    new AbortController().signal,
  );
  expect(widget.requestPayment).toEqual(expect.any(Function));
  expect(widget.destroy).toEqual(expect.any(Function));
  await widget.destroy();
});

it('keeps a safe return path on the mock payment result', async () => {
  vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'true');
  document.body.innerHTML = '<div id="methods"></div><div id="agreement"></div>';
  const widget = await mountPaymentWidget(
    order,
    { methods: '#methods', agreement: '#agreement' },
    new AbortController().signal,
    '/me/stats',
  );
  const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!checkbox) throw new Error('missing agreement');
  checkbox.checked = true;
  await expect(widget.requestPayment()).resolves.toContain('returnTo=%2Fme%2Fstats');
  await widget.destroy();
});
