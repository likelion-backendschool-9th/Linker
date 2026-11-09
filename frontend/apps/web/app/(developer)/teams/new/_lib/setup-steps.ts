export const STEPS = ['GitHub 연결', '팀 정보', '레포 연결', '보드 연결', '확인'] as const;

export function resolveSetupStep(value: number) {
  return Math.min(STEPS.length, Math.max(1, value));
}
