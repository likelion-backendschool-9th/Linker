import { emptyPostForm, postFormSchema, type PostFormValues } from './schema';

const valid: PostFormValues = { ...emptyPostForm(), intro: '한 줄 소개', body: '본문입니다.' };

const messages = (values: PostFormValues) => {
  const result = postFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

it('accepts plain Korean text', () => {
  expect(messages(valid)).toEqual([]);
});

it('rejects emoji in the one-line intro and the body (POL-P-2)', () => {
  expect(messages({ ...valid, intro: '배포 완료 🚀' })).toEqual(['이모지는 입력할 수 없어요.']);
  expect(messages({ ...valid, body: '감사합니다 🙏' })).toEqual(['이모지는 입력할 수 없어요.']);
});

it('caps the team size at 5 with the build-a-team copy (POL-P-2)', () => {
  expect(messages({ ...valid, teamSize: '5' })).toEqual([]);
  expect(messages({ ...valid, teamSize: '6' })).toEqual([
    '5명 이상은 팀 구축 후 결제를 통해 인원을 늘릴 수 있습니다',
  ]);
  expect(messages({ ...valid, teamSize: '0' })).toEqual(['팀 규모는 1명 이상으로 입력해 주세요.']);
});
