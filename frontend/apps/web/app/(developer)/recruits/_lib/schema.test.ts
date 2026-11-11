import {
  durationMonthsFromText,
  EMPTY_RECRUIT_FORM,
  recruitFormSchema,
  toRecruitRequest,
  type RecruitFormValues,
} from './schema';

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

it('rejects emoji in title, intro and region', () => {
  for (const field of ['title', 'intro', 'region'] as const) {
    expect(messages({ ...valid, [field]: `${valid[field]} 🚀` })).toEqual([
      '이모지는 입력할 수 없어요.',
    ]);
  }
});

it('takes the expected duration as whole months and sends it as "N개월"', () => {
  expect(messages({ ...valid, duration: '3' })).toEqual([]);
  expect(messages({ ...valid, duration: '99' })).toEqual([]);
  for (const duration of ['0', '100', '3개월', '2주']) {
    expect(messages({ ...valid, duration })).toEqual(['예상 기간은 1~99개월로 입력해 주세요.']);
  }
  expect(toRecruitRequest({ ...valid, duration: '3' }).duration).toBe('3개월');
  expect(toRecruitRequest({ ...valid, duration: '' }).duration).toBeNull();
});

it('reads saved duration text back as months, dropping what is not months', () => {
  expect(durationMonthsFromText('3개월')).toBe('3');
  expect(durationMonthsFromText('12')).toBe('12');
  expect(durationMonthsFromText('2주')).toBe('');
  expect(durationMonthsFromText(null)).toBe('');
});

describe('free team headcount cap (POL-R-1)', () => {
  const capped = {
    ...valid,
    roles: [
      { id: null, role: 'BACKEND', headcount: 3 },
      { id: null, role: 'FRONTEND', headcount: 3 },
    ],
  } satisfies RecruitFormValues;
  const capMessage = 'Flex를 구독하지 않은 팀은 모든 역할을 합쳐 5명까지 모집할 수 있어요.';

  it('allows 5 people across roles on a non-Flex team and rejects 6', () => {
    const atCap: RecruitFormValues = {
      ...capped,
      roles: [
        { id: null, role: 'BACKEND', headcount: 3 },
        { id: null, role: 'FRONTEND', headcount: 2 },
      ],
    };
    expect(messages(atCap)).toEqual([]);
    expect(messages(capped)).toEqual([capMessage]);
  });

  it('has no total cap on a Flex team', () => {
    const flexSchema = recruitFormSchema({
      today: '2026-11-05',
      maxDeadline: '2027-05-05',
      flexTeamIds: [1],
    });
    expect(flexSchema.safeParse(capped).success).toBe(true);
  });
});
