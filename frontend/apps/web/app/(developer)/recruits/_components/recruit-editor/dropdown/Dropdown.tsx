'use client';

// Custom select (Figma 629:508): the option box joins the trigger's bottom edge and pushes the
// rest of the form down — not a native <select> popup (can't be styled) or a floating panel.
import { AltArrowDownLinearIcon } from '@solar-icons/static/linear/alt-arrow-down';
import { useId, useState } from 'react';

import { Icon } from '@/components/ui/icon';

import styles from './Dropdown.module.css';

export type DropdownOption = { value: string; label: string };

type DropdownProps = {
  id?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  /** Red outline for a validation error; the message itself is reached via aria-describedby */
  invalid?: boolean;
  /** No choices to offer (e.g. no team to link): the trigger shows the placeholder and can't open */
  disabled?: boolean;
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
  'aria-describedby': ariaDescribedBy,
  invalid = false,
  disabled = false,
  value,
  placeholder,
  options,
  onChange,
  emptyIsPlaceholder = true,
}: DropdownProps) {
  const [openState, setOpen] = useState(false);
  const open = openState && !disabled;
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const showsPlaceholder = emptyIsPlaceholder && !value;

  const triggerClass = [styles.trigger, showsPlaceholder && styles.placeholder, open && styles.open, invalid && styles.invalid]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <button
        type="button"
        id={id}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-expanded={open}
        aria-controls={listId}
        className={triggerClass}
        disabled={disabled}
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
