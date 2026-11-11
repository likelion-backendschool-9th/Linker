'use client';

import { CloseLinearIcon } from '@solar-icons/static/linear/close';
import { MagnifierLinearIcon } from '@solar-icons/static/linear/magnifier';
import { useId, useRef } from 'react';

import { Icon } from '@/components/ui/icon';
import { useHeaderSearch } from './hook';

import styles from '../header.module.css';

type HeaderSearchProps = {
  /** Extra class merged onto the root, e.g. the mobile search panel's full-width variant */
  className?: string;
};

/** Top nav search field: blur/focus/active states (04 frontend task 4). Rendered in the panel below the search icon. */
export function HeaderSearch({ className }: HeaderSearchProps) {
  const { value, setValue, search, clear } = useHeaderSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  return (
    <form
      role="search"
      aria-label="피드 게시물 제목 검색"
      className={`${styles.search} ${className ?? ''}`}
      onSubmit={(event) => {
        event.preventDefault();
        search();
      }}
    >
      <Icon svg={MagnifierLinearIcon} className={`${styles.searchIcon} ${styles.magnifierIcon}`} />
      <label htmlFor={inputId} className="sr-only">
        검색어를 입력해 주세요
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        enterKeyHint="search"
        placeholder="검색어를 입력해 주세요"
        className={styles.searchInput}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      {value && (
        <button
          type="button"
          className={styles.searchClear}
          onClick={() => {
            clear();
            inputRef.current?.focus();
          }}
        >
          <Icon svg={CloseLinearIcon} />
          <span className="sr-only">검색어 지우기</span>
        </button>
      )}
    </form>
  );
}
