import type { ChatShareCard } from '@/features/share/chat-cards';
import { firstLinkerPath } from '@/features/share/message-links';
import { isBlocked } from '../pages/p00-common';
import type { MockMessage } from './chat';
import { POSTS } from './posts';
import { RECRUITS } from './recruits';
import { findUserById, findUser } from './users';

export function resolveShareCard(targetType: string, targetId: number): ChatShareCard {
  const unavailable = {
    targetType: targetType as ChatShareCard['targetType'],
    targetId,
    title: '볼 수 없는 게시물이에요',
    summary: null,
    imageUrl: null,
    linkPath: null,
    available: false,
  };
  if (targetType === 'POST') {
    const post = POSTS.find((item) => item.id === targetId);
    if (!post || post.visibility !== 'VISIBLE' || isBlocked(post.author.id)) return unavailable;
    return {
      targetType,
      targetId,
      title: post.repo.fullName,
      summary: `${post.intro} · ${post.author.name}`,
      imageUrl: post.photos[0] ?? null,
      linkPath: `/posts/${targetId}?from=chat_share`,
      available: true,
    };
  }
  if (targetType === 'RECRUIT_POST') {
    const post = RECRUITS.find((item) => item.id === targetId);
    if (!post || isBlocked(post.author.id)) return unavailable;
    return {
      targetType,
      targetId,
      title: post.title,
      summary: `${post.roles.map((role) => `${role.name} ${Math.max(0, role.headcount - role.filled)}명`).join(' · ')} · ${post.deadline} 마감`,
      imageUrl: null,
      linkPath: `/recruits/${targetId}`,
      available: true,
    };
  }
  if (targetType === 'PROFILE') {
    const user = findUserById(targetId);
    if (!user || isBlocked(user.id)) return unavailable;
    return {
      targetType,
      targetId,
      title: user.name,
      summary: `@${user.login} · ${user.techStack.join(', ')}`,
      imageUrl: user.avatarUrl,
      linkPath: `/user/${user.login}`,
      available: true,
    };
  }
  return unavailable;
}

/** Resolve each reader's current view, including URL cards; never store title/image snapshots. */
export function withShareCards(message: MockMessage, payload: Record<string, unknown> | null) {
  if (message.deletedAt) return null;
  if (message.type === 'SHARE_CARD')
    return resolveShareCard(String(payload?.targetType), Number(payload?.targetId));
  const origins = [process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'];
  if (typeof window !== 'undefined') origins.push(window.location.origin);
  const path = firstLinkerPath(message.text ?? '', origins);
  if (!path) return payload;
  const [, kind, id] = path.split('/');
  const type = kind === 'posts' ? 'POST' : kind === 'recruits' ? 'RECRUIT_POST' : 'PROFILE';
  const targetId = type === 'PROFILE' ? (findUser(id ?? '')?.id ?? 0) : Number(id);
  return { ...payload, linkerCard: resolveShareCard(type, targetId) };
}
