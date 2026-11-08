import { z } from 'zod';

import {
  RECRUIT_FORMATS,
  RECRUIT_GOALS,
  RECRUIT_ROLES,
  type RecruitFormat,
  type RecruitGoal,
  type RecruitRoleKey,
} from '@/features/recruit/recruit-labels';
import { countChars, normalizeLineBreaks } from '@/lib/format/text';
import { RECRUIT } from '@/lib/policy';

import type { RecruitRequest } from './editor-queries';

/**
 * 20 editor values (POL-R-1). Selects and radios keep strings (`''` = none) so the inputs stay
 * controlled by react-hook-form; `toRecruitRequest` turns them into the API body. Also the device draft.
 */
export type RecruitFormValues = {
  title: string;
  intro: string;
  /** `id` = existing role on edit (locked roles keep it), null = new */
  roles: { id: number | null; role: RecruitRoleKey; headcount: number }[];
  format: RecruitFormat;
  region: string;
  goal: RecruitGoal | '';
  duration: string;
  /** `yyyy-MM-dd` (KST) */
  deadline: string;
  techTags: string[];
  /** Team id as a string, `''` = no team yet */
  teamId: string;
};

export const EMPTY_RECRUIT_FORM: RecruitFormValues = {
  title: '',
  intro: '',
  // Empty until the user adds one via the "역할 추가" sheet (Figma 257:2512 empty state)
  roles: [],
  format: 'ONLINE',
  region: '',
  goal: '',
  duration: '',
  deadline: '',
  techTags: [],
  teamId: '',
};

type SchemaContext = {
  /** Today in KST, `yyyy-MM-dd` */
  today: string;
  /** Last allowed deadline from the server (today + 60 days) */
  maxDeadline: string;
  /** Edit: accepted headcount per existing role id; headcount can't go below it */
  minHeadcountByRole?: Record<string, number>;
};

const { min: HEADCOUNT_MIN, max: HEADCOUNT_MAX } = RECRUIT.headcountPerRole;
const limit = (max: number) => max.toLocaleString('ko-KR');

export function recruitFormSchema({ today, maxDeadline, minHeadcountByRole = {} }: SchemaContext) {
  return z
    .object({
      title: z
        .string()
        .refine((value) => countChars(value) > 0, '제목을 입력해 주세요.')
        .refine(
          (value) => countChars(value) <= RECRUIT.titleMax,
          `제목은 ${limit(RECRUIT.titleMax)}자까지 쓸 수 있어요.`,
        ),
      intro: z
        .string()
        .refine((value) => countChars(value) > 0, '소개를 입력해 주세요.')
        .refine(
          (value) => countChars(value) <= RECRUIT.introMax,
          `소개는 ${limit(RECRUIT.introMax)}자까지 쓸 수 있어요.`,
        ),
      roles: z
        .array(
          z.object({
            id: z.number().nullable(),
            role: z.enum(RECRUIT_ROLES),
            headcount: z
              .number({ error: '인원을 입력해 주세요.' })
              .int('인원은 정수로 입력해 주세요.')
              .min(HEADCOUNT_MIN, `인원은 ${HEADCOUNT_MIN}명 이상이어야 해요.`)
              .max(HEADCOUNT_MAX, `한 역할에 ${HEADCOUNT_MAX}명까지 모집할 수 있어요.`),
          }),
        )
        .min(1, '모집할 역할을 하나 이상 추가해 주세요.')
        .superRefine((roles, ctx) => {
          const seen = new Set<string>();
          roles.forEach((role, index) => {
            if (seen.has(role.role)) {
              ctx.addIssue({
                code: 'custom',
                path: [index, 'role'],
                message: '이미 추가한 역할이에요. 다른 역할을 골라 주세요.',
              });
            }
            seen.add(role.role);
            const accepted = role.id === null ? 0 : (minHeadcountByRole[role.id] ?? 0);
            if (role.headcount < accepted) {
              ctx.addIssue({
                code: 'custom',
                path: [index, 'headcount'],
                message: `이미 수락한 ${accepted}명보다 줄일 수 없어요.`,
              });
            }
          });
        }),
      format: z.enum(RECRUIT_FORMATS),
      region: z.string(),
      goal: z.union([z.enum(RECRUIT_GOALS), z.literal('')]),
      duration: z.string(),
      deadline: z
        .string()
        .min(1, '마감일을 골라 주세요.')
        .refine(
          (value) => value >= today && value <= maxDeadline,
          `마감일은 오늘부터 ${RECRUIT.deadlineWithinDays}일 안으로 골라 주세요.`,
        ),
      techTags: z
        .array(z.string())
        .max(RECRUIT.techTagsMax, `기술 스택은 ${RECRUIT.techTagsMax}개까지 고를 수 있어요.`),
      teamId: z.string(),
    })
    .superRefine((values, ctx) => {
      if (values.format === 'OFFLINE' && !values.region.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['region'],
          message: '오프라인 모집은 지역을 입력해 주세요.',
        });
      }
    });
}

/** Form values → `POST/PUT /api/v1/user/recruits` body */
export function toRecruitRequest(values: RecruitFormValues): RecruitRequest {
  const region = values.region.trim();
  return {
    title: values.title.trim(),
    intro: normalizeLineBreaks(values.intro.trim()),
    roles: values.roles.map(({ id, role, headcount }) =>
      id === null ? { role, headcount } : { id, role, headcount },
    ),
    format: values.format,
    region: values.format === 'ONLINE' || !region ? null : region,
    goal: values.goal || null,
    duration: values.duration.trim() || null,
    deadline: values.deadline,
    techTags: values.techTags,
    teamId: values.teamId ? Number(values.teamId) : null,
  };
}
