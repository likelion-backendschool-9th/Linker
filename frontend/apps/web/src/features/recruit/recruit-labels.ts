/**
 * Recruit post enums and their Korean labels, shared by 19 list, 20 editor and 21 detail (07 TODO 19–21).
 * `RecruitRoleKey` follows ERD `recruit_roles.role` ("FRONTEND, BACKEND, DESIGN, ..."); the rest of the
 * list is provisional until the backend fixes the enum.
 */

export const RECRUIT_FORMATS = ['ONLINE', 'OFFLINE', 'HYBRID'] as const;
export type RecruitFormat = (typeof RECRUIT_FORMATS)[number];

export const RECRUIT_FORMAT_LABELS: Record<RecruitFormat, string> = {
  ONLINE: '온라인',
  OFFLINE: '오프라인',
  HYBRID: '온·오프라인',
};

export const RECRUIT_GOALS = ['CONTEST', 'HACKATHON', 'LAUNCH', 'LEARNING'] as const;
export type RecruitGoal = (typeof RECRUIT_GOALS)[number];

export const RECRUIT_GOAL_LABELS: Record<RecruitGoal, string> = {
  CONTEST: '공모전',
  HACKATHON: '해커톤',
  LAUNCH: '출시',
  LEARNING: '학습',
};

export const RECRUIT_ROLES = [
  'FRONTEND',
  'BACKEND',
  'FULLSTACK',
  'MOBILE',
  'DESIGN',
  'DATA_AI',
  'DEVOPS',
  'PM',
  'ETC',
] as const;
export type RecruitRoleKey = (typeof RECRUIT_ROLES)[number];

export const RECRUIT_ROLE_LABELS: Record<RecruitRoleKey, string> = {
  FRONTEND: '프론트엔드',
  BACKEND: '백엔드',
  FULLSTACK: '풀스택',
  MOBILE: '앱 개발',
  DESIGN: '디자이너',
  DATA_AI: '데이터/AI',
  DEVOPS: 'DevOps/인프라',
  PM: '기획',
  ETC: '기타',
};
