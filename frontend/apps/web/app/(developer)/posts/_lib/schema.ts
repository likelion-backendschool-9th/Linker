import { z } from 'zod';

import type { UploadedImage } from '@/features/image-upload/upload-image';
import { countChars, normalizeLineBreaks } from '@/lib/format/text';
import { POST } from '@/lib/policy';

import type { PostRequest } from './editor-queries';

/**
 * 22 content-step values (POL-P-2). Numbers and months stay strings (`''` = empty) so the inputs are
 * controlled by react-hook-form; `toPostRequest` builds the API body. Also kept as the device draft.
 */
export type PostFormValues = {
  intro: string;
  body: string;
  myRole: string;
  demoLinks: { url: string }[];
  /** `yyyy-MM` */
  periodStart: string;
  periodEnd: string;
  teamSize: string;
  tags: string[];
};

/** What 22 keeps on the device: the chosen repo, the form, and the photos already uploaded */
export type PostDraft = { repoId: number; values: PostFormValues; photos: UploadedImage[] };

export const emptyPostForm = (body = ''): PostFormValues => ({
  intro: '',
  body,
  myRole: '',
  // Figma 22-2 always shows three link rows
  demoLinks: Array.from({ length: POST.demoLinksMax }, () => ({ url: '' })),
  periodStart: '',
  periodEnd: '',
  teamSize: '',
  tags: [],
});

const isHttps = (value: string) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

const { min: TEAM_MIN, max: TEAM_MAX } = POST.teamSize;
const limit = (max: number) => max.toLocaleString('ko-KR');

export const postFormSchema = z
  .object({
    intro: z
      .string()
      .refine((value) => countChars(value) >= POST.intro.min, '한 줄 소개를 입력해 주세요.')
      .refine(
        (value) => countChars(value) <= POST.intro.max,
        `한 줄 소개는 ${POST.intro.max}자까지 쓸 수 있어요.`,
      ),
    body: z
      .string()
      .refine(
        (value) => countChars(value) <= POST.bodyMax,
        `본문은 ${limit(POST.bodyMax)}자까지 쓸 수 있어요.`,
      ),
    myRole: z
      .string()
      .refine(
        (value) => countChars(value) <= POST.roleMax,
        `내 역할은 ${POST.roleMax}자까지 쓸 수 있어요.`,
      ),
    demoLinks: z
      .array(
        z.object({
          url: z
            .string()
            .trim()
            .refine(
              (value) => !value || isHttps(value),
              'https://로 시작하는 주소만 넣을 수 있어요.',
            ),
        }),
      )
      .max(POST.demoLinksMax),
    periodStart: z.string(),
    periodEnd: z.string(),
    teamSize: z.string().refine((value) => {
      if (!value) return true;
      const size = Number(value);
      return Number.isInteger(size) && size >= TEAM_MIN && size <= TEAM_MAX;
    }, `팀 규모는 ${TEAM_MIN}~${TEAM_MAX}명으로 입력해 주세요.`),
    tags: z.array(z.string()).max(POST.tagsMax),
  })
  .superRefine((values, ctx) => {
    if (values.periodEnd && !values.periodStart) {
      ctx.addIssue({
        code: 'custom',
        path: ['periodStart'],
        message: '시작한 달을 먼저 골라 주세요.',
      });
    } else if (values.periodEnd && values.periodEnd < values.periodStart) {
      ctx.addIssue({
        code: 'custom',
        path: ['periodEnd'],
        message: '끝난 달은 시작한 달과 같거나 그 뒤여야 해요.',
      });
    }
  });

/** Form values + photos → `POST/PUT /api/v1/user/posts` body (without `repoId`) */
export function toPostRequest(
  values: PostFormValues,
  photos: UploadedImage[],
): Omit<PostRequest, 'repoId'> {
  const role = values.myRole.trim();
  return {
    intro: values.intro.trim(),
    body: normalizeLineBreaks(values.body.trim()),
    photos,
    myRole: role || null,
    demoLinks: values.demoLinks.map((link) => link.url.trim()).filter(Boolean),
    period: values.periodStart
      ? { start: values.periodStart, end: values.periodEnd || null }
      : null,
    teamSize: values.teamSize ? Number(values.teamSize) : null,
    tags: values.tags,
  };
}
