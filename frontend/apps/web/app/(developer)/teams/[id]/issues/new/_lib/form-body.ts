import { z } from 'zod';

import type { FormField } from './create-queries';

/**
 * Issue form (YAML) answers ↔ GitHub issue body (POL-I-1): each item becomes `### label` followed by the
 * answer, an empty answer is `_No response_`, checkboxes are a task list. Same output GitHub makes.
 */

export type FormAnswers = Record<string, string | string[] | boolean[]>;

const NO_RESPONSE = '_No response_';

/** Items the screen shows as inputs */
export function isInputField(
  field: FormField,
): field is Extract<FormField, { type: 'input' | 'textarea' | 'dropdown' | 'checkboxes' }> {
  return ['input', 'textarea', 'dropdown', 'checkboxes'].includes(field.type);
}

export function emptyAnswers(fields: FormField[]): FormAnswers {
  const answers: FormAnswers = {};
  for (const field of fields) {
    if (!isInputField(field)) continue;
    if (field.type === 'checkboxes') answers[field.id] = field.options.map(() => false);
    else if (field.type === 'dropdown' && field.multiple) answers[field.id] = [];
    else answers[field.id] = '';
  }
  return answers;
}

export function buildFormBody(fields: FormField[], answers: FormAnswers): string {
  const sections: string[] = [];
  for (const field of fields) {
    if (field.type === 'markdown' || field.type === 'upload') continue;
    const label = 'label' in field && field.label ? field.label : field.id;
    if (!isInputField(field)) {
      // Not supported in the app: heading only (04 ch. 7 exceptions)
      sections.push(`### ${label}\n\n${NO_RESPONSE}`);
      continue;
    }
    const answer = answers[field.id];
    if (field.type === 'checkboxes') {
      const checked = Array.isArray(answer) ? (answer as boolean[]) : [];
      const list = field.options
        .map((option, index) => `- [${checked[index] ? 'X' : ' '}] ${option.label}`)
        .join('\n');
      sections.push(`### ${label}\n\n${list}`);
      continue;
    }
    const text = Array.isArray(answer) ? answer.join(', ') : String(answer ?? '').trim();
    sections.push(`### ${label}\n\n${text || NO_RESPONSE}`);
  }
  return sections.join('\n\n');
}

/** zod schema for the form's required items, messages in the UI copy tone (04 ch. 12) */
export function formSchema(fields: FormField[]): z.ZodType<FormAnswers, FormAnswers> {
  const shape: Record<string, z.ZodType> = {};
  for (const field of fields) {
    if (!isInputField(field)) continue;
    if (field.type === 'checkboxes') {
      shape[field.id] = z
        .array(z.boolean())
        .refine(
          (values) => field.options.every((option, index) => !option.required || values[index]),
          { message: '꼭 확인해야 하는 항목이 있어요.' },
        );
    } else if (field.type === 'dropdown' && field.multiple) {
      shape[field.id] = field.required
        ? z.array(z.string()).min(1, '하나 이상 골라 주세요.')
        : z.array(z.string());
    } else if (field.required) {
      shape[field.id] = z
        .string()
        .trim()
        .min(1, field.type === 'dropdown' ? '하나를 골라 주세요.' : '필수 항목이에요.');
    } else {
      shape[field.id] = z.string();
    }
  }
  // The keys come from the template at runtime, so the static type is the answers map
  return z.object(shape) as unknown as z.ZodType<FormAnswers, FormAnswers>;
}
