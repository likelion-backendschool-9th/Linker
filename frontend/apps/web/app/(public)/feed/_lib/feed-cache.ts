import type { InfiniteData, Query, QueryClient } from '@tanstack/react-query';

import type { FeedPage, FeedPost } from './feed-queries';

/** Caches that hold a post card: both feed tabs (`['feed', login, offersOnly, tab]`) and profile posts (04) */
export function isCardQuery(query: Query) {
  const [scope, , third] = query.queryKey;
  return (scope === 'feed' && typeof third === 'boolean') || scope === 'profile-posts';
}

/** Patch one post in every cached card list (likes, comment counts) */
export function patchCards(
  client: QueryClient,
  postId: number,
  patch: (post: FeedPost) => FeedPost,
) {
  const fix = (post: FeedPost) => (post.id === postId ? patch(post) : post);
  client.setQueriesData<InfiniteData<FeedPage> | { items: FeedPost[] }>(
    { predicate: isCardQuery },
    (data) => {
      if (!data) return data;
      if ('pages' in data) {
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.type === 'POST' ? { ...item, post: fix(item.post) } : item,
            ),
          })),
        };
      }
      return { ...data, items: data.items.map(fix) };
    },
  );
}

/** Patch every cached card by one author (follow state shows on each of their cards) */
export function patchAuthorCards(
  client: QueryClient,
  authorId: number,
  patch: (author: FeedPost['author']) => FeedPost['author'],
) {
  client.setQueriesData<InfiniteData<FeedPage> | { items: FeedPost[] }>(
    { predicate: isCardQuery },
    (data) => {
      if (!data) return data;
      const fix = (post: FeedPost) =>
        post.author.id === authorId ? { ...post, author: patch(post.author) } : post;
      if ('pages' in data) {
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.type === 'POST' ? { ...item, post: fix(item.post) } : item,
            ),
          })),
        };
      }
      return { ...data, items: data.items.map(fix) };
    },
  );
}
