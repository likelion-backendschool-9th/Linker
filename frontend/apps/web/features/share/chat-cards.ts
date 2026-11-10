import type { ShareTargetType } from './share-api';

/** Matches ChatShareCardResponse. Metadata is resolved by the server for each reader. */
export type ChatShareCard = {
  targetType: ShareTargetType;
  targetId: number;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  linkPath: string | null;
  available: boolean;
};

export function messagePayload(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      return messagePayload(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function readShareCard(value: unknown): ChatShareCard | null {
  const card = messagePayload(value);
  if (
    !card ||
    !['POST', 'RECRUIT_POST', 'PROFILE'].includes(String(card.targetType)) ||
    typeof card.targetId !== 'number' ||
    !Number.isSafeInteger(card.targetId) ||
    card.targetId < 1 ||
    typeof card.available !== 'boolean' ||
    typeof card.title !== 'string'
  )
    return null;
  return {
    targetType: card.targetType as ShareTargetType,
    targetId: card.targetId,
    available: card.available,
    title: card.title,
    summary: typeof card.summary === 'string' ? card.summary : null,
    imageUrl: typeof card.imageUrl === 'string' ? card.imageUrl : null,
    linkPath: typeof card.linkPath === 'string' ? card.linkPath : null,
  };
}

/** Validate the server-provided path and preserve the CHAT_SHARE source on both card variants. */
export function shareCardHref(card: ChatShareCard): string | null {
  if (!card.available || !card.linkPath) return null;
  const path = card.linkPath.split(/[?#]/)[0];
  if (card.targetType === 'POST' && path === `/posts/${card.targetId}`)
    return `${path}?from=chat_share`;
  if (card.targetType === 'RECRUIT_POST' && path === `/recruits/${card.targetId}`) return path;
  // Older backend profile cards still use /users; the current public route is /user.
  if (card.targetType === 'PROFILE' && /^\/(?:user|users)\/[\w-]+$/.test(path ?? ''))
    return path!.replace(/^\/users\//, '/user/');
  return null;
}
