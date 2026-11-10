import { buildFormBody, emptyAnswers, formSchema, toApiAnswers } from './form-body';
import type { FormField } from './create-queries';

const fields: FormField[] = [
  { id: 'intro', type: 'markdown', value: '안내' },
  { id: 'summary', type: 'input', label: '요약', required: true },
  { id: 'detail', type: 'textarea', label: '자세한 내용' },
  { id: 'kind', type: 'dropdown', label: '종류', options: ['기능', '버그'], required: true },
  { id: 'os', type: 'dropdown', label: 'OS', options: ['iOS', 'Android'], multiple: true },
  {
    id: 'checks',
    type: 'checkboxes',
    label: '확인',
    options: [{ label: '중복 확인', required: true }, { label: '재현 가능' }],
  },
  { id: 'shot', type: 'upload', label: '스크린샷' },
  { id: 'future', type: 'datepicker', label: '날짜' },
];

it('writes the body in GitHub issue form format (POL-I-1)', () => {
  const answers = {
    ...emptyAnswers(fields),
    summary: '  다크 모드  ',
    kind: '기능',
    os: ['iOS', 'Android'],
    checks: [true, false],
  };
  expect(buildFormBody(fields, answers)).toBe(
    [
      '### 요약\n\n다크 모드',
      '### 자세한 내용\n\n_No response_',
      '### 종류\n\n기능',
      '### OS\n\niOS, Android',
      '### 확인\n\n- [X] 중복 확인\n- [ ] 재현 가능',
      // Unsupported items keep only their heading (04 ch. 7 exceptions)
      '### 날짜\n\n_No response_',
    ].join('\n\n'),
  );
});

it('maps UI answers to OpenAPI string arrays', () => {
  expect(
    toApiAnswers(fields, {
      ...emptyAnswers(fields),
      summary: '다크 모드',
      kind: '기능',
      os: ['iOS'],
      checks: [true, false],
    }),
  ).toEqual({
    summary: ['다크 모드'],
    detail: [],
    kind: ['기능'],
    os: ['iOS'],
    checks: ['중복 확인'],
  });
});

it('requires required inputs, dropdowns and checkbox options', () => {
  const result = formSchema(fields).safeParse(emptyAnswers(fields));
  expect(result.success).toBe(false);
  const messages = Object.fromEntries(
    (result.error?.issues ?? []).map((issue) => [issue.path[0], issue.message]),
  );
  expect(messages).toEqual({
    summary: '필수 항목이에요.',
    kind: '하나를 골라 주세요.',
    checks: '꼭 확인해야 하는 항목이 있어요.',
  });
});
