import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';
import { ExternalLinkPreview } from './ExternalLinkPreview';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);
beforeEach(() => fetchMock.mockReset());

it('requests only the first external link and uses the external-site sheet', async () => {
  fetchMock.mockResolvedValue({
    title: '외부 문서',
    description: '문서 소개',
    imageUrl: null,
    url: 'https://example.test/docs',
  });
  const user = userEvent.setup();
  const onUrlUpdate = vi.fn();
  renderWithProviders(
    <ExternalLinkPreview
      roomId={1}
      text={`${window.location.origin}/posts/1 https://example.test/docs https://second.test`}
    />,
    { viewer: { role: 'developer', login: 'seojun' }, onUrlUpdate },
  );
  const link = await screen.findByRole('link', { name: /외부 문서/ });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/user/chat-rooms/1/link-preview?url=https%3A%2F%2Fexample.test%2Fdocs',
    expect.anything(),
  );
  await user.click(link);
  await waitFor(() =>
    expect(onUrlUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ queryString: expect.stringContaining('overlay=external-link') }),
    ),
  );
});

it('does not fetch OG metadata for an internal URL or ordinary text', () => {
  renderWithProviders(
    <ExternalLinkPreview roomId={1} text={`${window.location.origin}/posts/1 평범한 대화`} />,
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

it('omits the preview when the server denies access or metadata is unavailable', async () => {
  fetchMock.mockResolvedValue(null);
  renderWithProviders(<ExternalLinkPreview roomId={11} text="https://example.test/docs" />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
