import { publicShareUrl } from './share-api';
import { firstExternalUrl, firstLinkerPath } from './message-links';
import { readShareCard, shareCardHref } from './chat-cards';

it('copies only a public content path with the external-share marker', () => {
  expect(publicShareUrl('/posts/42', 'https://linker.test')).toBe(
    'https://linker.test/posts/42?from=share',
  );
  expect(publicShareUrl('/user/seojun-han', 'https://linker.test')).toBe(
    'https://linker.test/user/seojun-han?from=share',
  );
  for (const path of [
    '//evil.test/posts/42',
    '/chats/1',
    '/posts/42?overlay=report',
    'https://evil.test/posts/42',
  ]) {
    expect(() => publicShareUrl(path, 'https://linker.test')).toThrow();
  }
});

it('counts the first internal and first external links separately', () => {
  const text =
    'https://linker.test/posts/42?from=share https://example.test/docs. https://linker.test/user/name';
  expect(firstLinkerPath(text, ['https://linker.test'])).toBe('/posts/42');
  expect(firstExternalUrl(text, ['https://linker.test'])).toBe('https://example.test/docs');
  expect(firstLinkerPath('https://linker.test.evil/posts/42', ['https://linker.test'])).toBeNull();
  expect(firstExternalUrl('javascript:alert(1) https://name:pass@evil.test', [])).toBeNull();
});

it('accepts serialized payloads and refuses unresolved or unsafe card navigation', () => {
  const card = readShareCard(
    JSON.stringify({
      targetType: 'POST',
      targetId: 42,
      title: '작업물',
      summary: null,
      imageUrl: null,
      linkPath: '/posts/42?from=share',
      available: true,
    }),
  )!;
  expect(shareCardHref(card)).toBe('/posts/42?from=chat_share');
  expect(shareCardHref({ ...card, available: false })).toBeNull();
  expect(shareCardHref({ ...card, linkPath: 'https://evil.test/posts/42' })).toBeNull();
  expect(shareCardHref({ ...card, linkPath: '/posts/43' })).toBeNull();
  expect(readShareCard({ targetType: 'POST', targetId: 42 })).toBeNull();
  expect(readShareCard('broken JSON')).toBeNull();
  expect(shareCardHref({ ...card, targetType: 'PROFILE', linkPath: '/users/seojun-han' })).toBe(
    '/user/seojun-han',
  );
});
