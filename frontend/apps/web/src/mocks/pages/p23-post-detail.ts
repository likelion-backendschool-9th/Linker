import {
  daysAgo,
  del,
  fail,
  get,
  hoursAgo,
  newId,
  patch,
  post,
  type MockRoute,
} from '../core/define';
import { findPost, POSTS, postCard } from '../fixtures/posts';
import { brief, DEVELOPERS, ME, OTHERS } from '../fixtures/users';

/** 23 Project post detail: `PostDetailController` */

const [, doyun, seoyeon, , hayun] = DEVELOPERS;
const liked = new Set<number>([2]);

type Comment = {
  id: number;
  postId: number;
  parentId: number | null;
  author: ReturnType<typeof brief>;
  text: string | null;
  deleted: boolean;
  createdAt: string;
  editedAt: string | null;
};

const comments: Comment[] = [
  {
    id: 1,
    postId: 1,
    parentId: null,
    author: brief(seoyeon!),
    text: '구조가 깔끔해서 참고하고 있어요!',
    deleted: false,
    createdAt: hoursAgo(30),
    editedAt: null,
  },
  {
    id: 2,
    postId: 1,
    parentId: 1,
    author: brief(ME),
    text: '감사합니다 :) 접근성 쪽은 axe로 계속 확인하고 있어요.',
    deleted: false,
    createdAt: hoursAgo(28),
    editedAt: null,
  },
  {
    id: 3,
    postId: 1,
    parentId: null,
    author: brief(doyun!),
    text: null,
    deleted: true,
    createdAt: daysAgo(1),
    editedAt: null,
  },
  {
    id: 4,
    postId: 1,
    parentId: 3,
    author: brief(hayun!),
    text: '삭제된 댓글에 달린 답글이에요.',
    deleted: false,
    createdAt: hoursAgo(20),
    editedAt: null,
  },
  {
    id: 5,
    postId: 2,
    parentId: null,
    author: brief(ME),
    text: '재연결 처리 부분이 인상적이에요.',
    deleted: false,
    createdAt: daysAgo(3),
    editedAt: null,
  },
];

function postOr404(id: string) {
  const item = findPost(id);
  if (!item || item.visibility !== 'VISIBLE') {
    fail(404, 'NOT_FOUND', '삭제되었거나 볼 수 없는 게시물이에요.');
  }
  return item;
}

export const routes: MockRoute[] = [
  get('/api/v1/public/posts/:postId', ({ params, query, viewer }) => {
    const item = postOr404(params.postId!);
    const isAuthor = viewer.me?.id === item.author.id;
    return {
      ...item,
      likeCount: item.likeCount + (liked.has(item.id) ? 0 : 0),
      commentCount:
        comments.filter((c) => c.postId === item.id && !c.deleted).length || item.commentCount,
      isAuthor,
      // Guests and recruiters can read but not react (04 ch. 2)
      likedByMe: viewer.me ? liked.has(item.id) : false,
      // Only the author sees stats links; ?from=share counts as the "external link" source (POL-P-7)
      trafficSource: query.get('from') === 'share' ? 'EXTERNAL_LINK' : 'DIRECT',
      canSendOffer: viewer.role === 'recruiter',
    };
  }),
  get('/api/v1/public/posts/:postId/readme', ({ params }) => {
    const item = postOr404(params.postId!);
    return {
      repo: item.repo.fullName,
      markdown: `# ${item.repo.fullName.split('/')[1]}\n\n${item.intro}\n\n## 실행 방법\n\`\`\`bash\npnpm install\npnpm dev\n\`\`\`\n\n## 기술 스택\n${item.tags.map((t) => `- ${t}`).join('\n')}`,
      cachedAt: hoursAgo(0.5),
    };
  }),
  post(
    '/api/v1/user/posts/:postId/likes',
    ({ params }) => {
      const item = postOr404(params.postId!);
      if (!liked.has(item.id)) {
        liked.add(item.id);
        item.likeCount += 1;
      }
      return { likeCount: item.likeCount };
    },
    { only: 'developer' },
  ),
  del(
    '/api/v1/user/posts/:postId/likes',
    ({ params }) => {
      const item = postOr404(params.postId!);
      if (liked.delete(item.id)) item.likeCount -= 1;
      return { likeCount: item.likeCount };
    },
    { only: 'developer' },
  ),
  // People list: login only (scraping guard, POL-A-9)
  get('/api/v1/user/posts/:postId/likes', () => ({
    items: OTHERS.slice(0, 5).map((user) => ({ user: brief(user) })),
    nextCursor: null,
  })),

  get('/api/v1/public/posts/:postId/comments', ({ params }) => ({
    items: comments
      .filter((c) => c.postId === Number(params.postId))
      .map((c) => ({
        ...c,
        // "삭제된 댓글입니다" is kept only when it has replies (POL-P-5)
        text: c.deleted ? '삭제된 댓글입니다' : c.text,
      })),
  })),
  post(
    '/api/v1/user/posts/:postId/comments',
    ({ params, body, viewer }) => {
      const text = String(body.text ?? '').trim();
      if (!text) fail(400, 'EMPTY', '내용을 입력해 주세요');
      if (text.length > 500) fail(400, 'TOO_LONG', '500자까지 쓸 수 있어요');
      const comment: Comment = {
        id: newId(),
        postId: Number(params.postId),
        parentId: (body.parentId as number | null | undefined) ?? null,
        author: brief(viewer.me!),
        text,
        deleted: false,
        createdAt: new Date().toISOString(),
        editedAt: null,
      };
      comments.push(comment);
      return comment;
    },
    { only: 'developer' },
  ),
  patch('/api/v1/user/posts/:postId/comments/:commentId', ({ params, body }) => {
    const comment = comments.find((c) => c.id === Number(params.commentId));
    if (!comment) fail(404, 'NOT_FOUND', '댓글을 찾지 못했어요');
    comment.text = String(body.text ?? comment.text);
    comment.editedAt = new Date().toISOString();
    return comment;
  }),
  del('/api/v1/user/posts/:postId/comments/:commentId', ({ params }) => {
    const index = comments.findIndex((c) => c.id === Number(params.commentId));
    const comment = comments[index];
    if (!comment) return undefined;
    const hasReplies = comments.some((c) => c.parentId === comment.id);
    if (hasReplies) {
      comment.deleted = true;
      comment.text = null;
    } else {
      comments.splice(index, 1);
    }
    return undefined;
  }),
  del('/api/v1/user/posts/:postId', ({ params }) => {
    const index = POSTS.findIndex((p) => p.id === Number(params.postId));
    if (index >= 0) POSTS.splice(index, 1);
    return undefined;
  }),
  get('/api/v1/public/posts/:postId/same-repo-posts', ({ params }) => {
    const item = findPost(params.postId!);
    return {
      items: POSTS.filter(
        (p) => item && p.id !== item.id && p.repo.repoId === item.repo.repoId,
      ).map(postCard),
    };
  }),
];
