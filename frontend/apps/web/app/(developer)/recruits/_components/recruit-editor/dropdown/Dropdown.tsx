'use client';

// Custom select (Figma 600:733): expands inline below the trigger, pushing the rest of the
// form down — not a native <select> popup (can't be styled) or a floating/portal panel.
import { AltArrowDownLinearIcon } from '@solar-icons/static/linear/alt-arrow-down';
import { useId, useState } from 'react';

import { Icon } from '@/components/ui/icon';

import styles from './Dropdown.module.css';

export type DropdownOption = { value: string; label: string };

type DropdownProps = {
  id?: string;
  'aria-labelledby'?: string;
  /** '' means no selection */
  value: string;
  placeholder: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  /** false when '' is itself a real choice (e.g. "no team"), not an unanswered prompt */
  emptyIsPlaceholder?: boolean;
};

export function Dropdown({
  id,
  'aria-labelledby': ariaLabelledBy,
  value,
  placeholder,
  options,
  onChange,
  emptyIsPlaceholder = true,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const showsPlaceholder = emptyIsPlaceholder && !value;

  return (
    <div>
      <button
        type="button"
        id={id}
        aria-labelledby={ariaLabelledBy}
        aria-expanded={open}
        aria-controls={listId}
        className={`${styles.trigger} ${showsPlaceholder ? styles.placeholder : ''}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <Icon
          svg={AltArrowDownLinearIcon}
          className={open ? styles.chevronOpen : styles.chevron}
        />
      </button>
      {open && (
        <div id={listId} role="listbox" aria-labelledby={ariaLabelledBy} className={styles.panel}>
          {!emptyIsPlaceholder && (
            <button
              type="button"
              role="option"
              aria-selected={value === ''}
              className={styles.item}
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              {placeholder}
            </button>
          )}
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={styles.item}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
