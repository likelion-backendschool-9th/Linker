'use client';

import { Search, X } from 'lucide-react';
import { useRef, useState } from 'react';

import styles from './header.module.css';

/** Desktop top nav search field: blur/focus/active states (04 frontend task 4). */
export function HeaderSearch() {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={styles.search}>
      <Search aria-hidden className={styles.searchIcon} />
      <label htmlFor="header-search" className="sr-only">
        검색어를 입력해 주세요
      </label>
      <input
        ref={inputRef}
        id="header-search"
        type="search"
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
            setValue('');
            inputRef.current?.focus();
          }}
        >
          <X aria-hidden className={styles.searchClearIcon} />
          <span className="sr-only">검색어 지우기</span>
        </button>
      )}
    </div>
  );
}
