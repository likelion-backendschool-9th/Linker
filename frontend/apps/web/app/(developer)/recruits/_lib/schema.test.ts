import { EMPTY_RECRUIT_FORM, recruitFormSchema, type RecruitFormValues } from './schema';

const schema = recruitFormSchema({ today: '2026-11-05', maxDeadline: '2027-05-05' });

const valid: RecruitFormValues = {
  ...EMPTY_RECRUIT_FORM,
  title: '팀원 모집',
  intro: '같이 해요.',
  roles: [{ id: null, role: 'BACKEND', headcount: 1 }],
  format: 'OFFLINE',
  region: '서울 강남',
  deadline: '2027-05-05',
  teamId: '1',
};

const messages = (values: RecruitFormValues) => {
  const result = schema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

it('accepts a deadline on the last allowed day (today + 6 months)', () => {
  expect(messages(valid)).toEqual([]);
});

it('rejects a deadline after the last allowed day with the 6-month copy', () => {
  expect(messages({ ...valid, deadline: '2027-05-06' })).toEqual([
    '마감일은 오늘부터 6개월 안으로 골라 주세요.',
  ]);
});

it('caps the region at the 100-character column length', () => {
  expect(messages({ ...valid, region: '가'.repeat(100) })).toEqual([]);
  expect(messages({ ...valid, region: '가'.repeat(101) })).toEqual([
    '지역은 100자까지 쓸 수 있어요.',
  ]);
});
