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
import { findPost, LIKED_POST_IDS, POSTS, postCard } from '../fixtures/posts';
import { brief, DEVELOPERS, ME, OTHERS } from '../fixtures/users';

/** 23 Project post detail: `PostController` */

const [, doyun, seoyeon, , hayun] = DEVELOPERS;
const liked = LIKED_POST_IDS;

type Comment = {
  id: number;
  postId: number;
  author: ReturnType<typeof brief>;
  text: string;
  createdAt: string;
  editedAt?: string | null;
};

const comments: Comment[] = [
  {
    id: 1,
    postId: 1,
    author: brief(seoyeon!),
    text: '구조가 깔끔해서 참고하고 있어요!',
    createdAt: hoursAgo(30),
  },
  {
    id: 3,
    postId: 1,
    author: brief(doyun!),
    text: '접근성 검사를 CI에 넣은 방법이 궁금했는데, 설정 파일까지 공개돼 있어서 바로 따라 해 볼 수 있었어요. 감사합니다!',
    createdAt: daysAgo(1),
  },
  {
    id: 4,
    postId: 1,
    author: brief(hayun!),
    text: '사진 넘기는 화면이 깔끔하네요. 다음 업데이트도 기대할게요.',
    createdAt: hoursAgo(20),
  },
  {
    id: 5,
    postId: 2,
    author: brief(ME),
    text: '재연결 처리 부분이 인상적이에요.',
    createdAt: daysAgo(3),
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
    const found = findPost(params.postId!);
    // Hidden by reports: only the author still sees it, marked "검토 중" (04 ch. 4 exceptions)
    const item = found && viewer.me?.id === found.author.id ? found : postOr404(params.postId!);
    const isAuthor = viewer.me?.id === item.author.id;
    return {
      ...item,
      likeCount: item.likeCount + (liked.has(item.id) ? 0 : 0),
      commentCount: comments.filter((c) => c.postId === item.id).length || item.commentCount,
      isAuthor,
      // Guests and recruiters can read but not react (04 ch. 2)
      likedByMe: viewer.me ? liked.has(item.id) : false,
      // Only the author sees stats links; ?from=share counts as the "external link" source (POL-P-7)
      trafficSource:
        query.get('from') === 'share'
          ? 'EXTERNAL_LINK'
          : query.get('from') === 'chat_share'
            ? 'CHAT_SHARE'
            : 'DIRECT',
      canSendOffer: viewer.role === 'recruiter',
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
    items: comments.filter((c) => c.postId === Number(params.postId)),
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
        author: brief(viewer.me!),
        text,
        createdAt: new Date().toISOString(),
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
    if (index >= 0) comments.splice(index, 1);
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
      // By name: fixture repo ids come from the name length and collide
      items: POSTS.filter(
        (p) => item && p.id !== item.id && p.repo.fullName === item.repo.fullName,
      ).map(postCard),
    };
  }),
];
