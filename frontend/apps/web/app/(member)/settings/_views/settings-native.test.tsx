import { encodeEnvelope } from '@linker/bridge';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import type { SettingsData } from '../_lib/settings-types';
import { SettingsCommon } from './SettingsCommon';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));

const settings: SettingsData = {
  github: null,
  notificationEmail: 'test@example.com',
  pushEnabled: false,
  plan: { name: 'Pro', label: 'Pro', kind: 'PRO' },
};

describe('Android push permission from settings', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset().mockResolvedValue({ pushEnabled: true });
  });
  afterEach(() => {
    delete window.ReactNativeWebView;
    vi.useRealTimers();
  });

  it('waits for a slow permission response before saving and prevents repeated requests', async () => {
    vi.useFakeTimers();
    const send = vi.fn();
    window.ReactNativeWebView = { postMessage: send };
    renderWithProviders(
      <SettingsCommon login="test" settings={settings}>
        {null}
      </SettingsCommon>,
    );
    const toggle = screen.getByRole('button', { name: '푸시 알림 꺼짐' });
    await act(async () => {
      fireEvent.click(toggle);
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(toggle).toBeDisabled();
    fireEvent.click(toggle);
    expect(send).toHaveBeenCalledOnce();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(toggle).toBeDisabled();
    expect(apiFetch).not.toHaveBeenCalled();
    const { msg } = JSON.parse(send.mock.calls[0]![0]);
    expect(msg.type).toBe('PUSH_PERMISSION_REQUEST');
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: encodeEnvelope({
            type: 'RESULT',
            id: msg.id,
            ok: true,
            payload: { status: 'granted' },
          }),
        }),
      );
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(apiFetch).toHaveBeenCalledExactlyOnceWith('/api/v1/user/me/settings/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pushEnabled: true }),
    });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toBeEnabled();
  });

  it('leaves the server preference unchanged when permission is denied', async () => {
    const send = vi.fn();
    window.ReactNativeWebView = { postMessage: send };
    renderWithProviders(
      <SettingsCommon login="test" settings={settings}>
        {null}
      </SettingsCommon>,
    );
    const toggle = screen.getByRole('button', { name: '푸시 알림 꺼짐' });
    fireEvent.click(toggle);
    await waitFor(() => expect(send).toHaveBeenCalledOnce());
    const { msg } = JSON.parse(send.mock.calls[0]![0]);
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: encodeEnvelope({
            type: 'RESULT',
            id: msg.id,
            ok: true,
            payload: { status: 'denied' },
          }),
        }),
      );
    });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('preserves D’s preference fallback if native push setup is not available', async () => {
    const send = vi.fn();
    window.ReactNativeWebView = { postMessage: send };
    renderWithProviders(
      <SettingsCommon login="test" settings={settings}>
        {null}
      </SettingsCommon>,
    );
    const toggle = screen.getByRole('button', { name: '푸시 알림 꺼짐' });
    fireEvent.click(toggle);
    await waitFor(() => expect(send).toHaveBeenCalledOnce());
    const { msg } = JSON.parse(send.mock.calls[0]![0]);
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: encodeEnvelope({
            type: 'RESULT',
            id: msg.id,
            ok: false,
            error: 'push-not-configured',
          }),
        }),
      );
    });
    await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'true'));
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/v1/user/me/settings/notifications',
      expect.anything(),
    );
  });
});
