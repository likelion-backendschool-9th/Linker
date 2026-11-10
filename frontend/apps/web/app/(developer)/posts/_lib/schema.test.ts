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
