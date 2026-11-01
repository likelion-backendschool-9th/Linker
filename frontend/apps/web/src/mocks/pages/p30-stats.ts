import { dateOnly, get, type MockRoute } from '../core/define';
import { POSTS } from '../fixtures/posts';
import { ME } from '../fixtures/users';
import { startOfWeek, subWeeks } from 'date-fns';
import { todayKst, toKst } from '@/lib/format/time';

/** 30 My stats: `StatsController`. Free scope: counts; Pro adds traffic sources and recruiter views. */

const SOURCES = ['FEED', 'PROFILE', 'RECRUIT_POST', 'CHAT_SHARE', 'EXTERNAL'] as const;

const mine = () => POSTS.filter((p) => p.author.id === ME.id);

export const routes: MockRoute[] = [
  get(
    '/api/v1/user/me/stats/summary',
    () => ({
      items: mine().map((p) => ({
        postId: p.id,
        intro: p.intro,
        likeCount: p.likeCount,
        commentCount: p.commentCount,
        viewCount: p.viewCount,
      })),
      isPro: true,
    }),
    { only: 'developer' },
  ),
  // Count only, never who (POL ch. 11)
  get(
    '/api/v1/user/me/stats/recruiter-views',
    ({ query }) => {
      const weeks = Number(query.get('weeks') ?? 8);
      return {
        thisWeek: 4,
        weeks: Array.from({ length: weeks }, (_, index) => ({
          weekStart: todayKst(
            subWeeks(startOfWeek(toKst(new Date()), { weekStartsOn: 1 }), weeks - 1 - index),
          ),
          count: [1, 0, 2, 3, 2, 5, 3, 4][index % 8] ?? 0,
        })),
      };
    },
    { only: 'developer' },
  ),
  get(
    '/api/v1/user/me/stats/posts',
    ({ query }) => {
      const days = Number(query.get('days') ?? 30);
      return {
        items: mine().map((p) => ({
          postId: p.id,
          intro: p.intro,
          bySource: SOURCES.map((source, i) => ({
            source,
            count:
              Math.floor(p.viewCount / SOURCES.length) + (i < p.viewCount % SOURCES.length ? 1 : 0),
          })),
          readmeExpands: Math.round(p.viewCount / 9),
          trend: Array.from({ length: days }, (_, index) => ({
            date: dateOnly(-(days - 1 - index)),
            views: Math.round((p.viewCount / days) * (0.6 + ((index * 7) % 10) / 12)),
          })),
        })),
      };
    },
    { only: 'developer' },
  ),
];
