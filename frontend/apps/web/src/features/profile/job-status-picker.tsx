'use client';

import type { UseFormRegisterReturn } from 'react-hook-form';

import styles from './job-status-picker.module.css';

const OPTIONS = [
  { value: 'SEEKING', label: '구직 중' },
  { value: 'OPEN', label: '제안만 받기' },
  { value: 'OFF', label: '끔' },
] as const;

export function JobStatusPicker({
  register,
  disabled = false,
}: {
  register: UseFormRegisterReturn;
  disabled?: boolean;
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend>구직 상태</legend>
      {OPTIONS.map((option) => (
        <label className={styles.option} key={option.value}>
          <input type="radio" value={option.value} disabled={disabled} {...register} />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
