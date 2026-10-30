import { fail, get, type MockRoute } from '../core/define';

/** 03 Legal documents: `LegalController`. Bodies are short Markdown stand-ins, not the real texts. */

const documents = [
  {
    slug: 'terms',
    title: '이용약관',
    version: '2026-10-01',
    effectiveDate: '2026-10-01',
    body: `# 이용약관\n\n## 제1조 (목적)\n이 약관은 Linker가 제공하는 서비스의 이용 조건과 절차를 정합니다.\n\n## 제2조 (회원)\n회원은 개발자 회원과 채용 담당자 회원으로 나뉩니다.\n\n- 개발자 회원은 GitHub 계정으로 가입해요.\n- 채용 담당자 회원은 회사 메일로 가입해요.\n\n## 제3조 (금지 행위)\n스팸, 허위 모집, 사칭 등은 [커뮤니티 정책](/legal/community)에 따라 제재돼요.\n\n문의: support@linker.example`,
  },
  {
    slug: 'privacy',
    title: '개인정보처리방침',
    version: '2026-10-01',
    effectiveDate: '2026-10-01',
    body: `# 개인정보처리방침\n\n## 1. 수집하는 항목\n| 구분 | 항목 |\n| --- | --- |\n| 필수 | GitHub ID, 이메일 |\n| 선택 | 블로그 주소, 관심 직군 |\n\n## 2. 보유 기간\n탈퇴 후 30일 뒤 삭제해요.\n\n문의: privacy@linker.example`,
  },
  {
    slug: 'community',
    title: '커뮤니티 정책',
    version: '2026-10-01',
    effectiveDate: '2026-10-01',
    body: `# 커뮤니티 정책\n\n## 금지 행위\n- 스팸·홍보\n- 욕설·비방·혐오\n- 개인정보 노출\n- 허위 모집·허위 채용 제안\n\n## 제재 단계\n경고 → 7일 정지 → 30일 정지 → 영구 정지 순서로 진행해요.`,
  },
  {
    slug: 'recruiter-terms',
    title: '기업회원 추가 약관',
    version: '2026-10-01',
    effectiveDate: '2026-10-01',
    body: `# 기업회원 추가 약관\n\n## 제1조\n채용 담당자는 회사 메일 인증 후 이용할 수 있어요.\n\n## 제2조 (프로필 열람 알림)\n채용 담당자가 개발자 프로필을 열람하면 개발자에게 **인원 수**로만 안내돼요.`,
  },
];

export const routes: MockRoute[] = [
  get('/api/v1/public/legal-documents', () =>
    documents.map(({ slug, title, version, effectiveDate }) => ({
      slug,
      title,
      version,
      effectiveDate,
    })),
  ),
  get('/api/v1/public/legal-documents/:slug', ({ params }) => {
    const document = documents.find((item) => item.slug === params.slug);
    if (!document) fail(404, 'NOT_FOUND', '삭제되었거나 볼 수 없는 콘텐츠예요');
    return document;
  }),
];
