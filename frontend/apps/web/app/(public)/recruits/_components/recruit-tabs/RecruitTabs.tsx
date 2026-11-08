import styles from './RecruitTabs.module.css';

const TABS = [
  { key: 'all', label: '전체' },
  { key: 'mine', label: '내 모집글' },
  { key: 'applied', label: '내 지원' },
] as const;

/** 19 recruit list tabs (Figma 254:2174): 전체/내 모집글/내 지원 */
export function RecruitTabs() {
  return (
    <div className={styles.tabs}>
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={styles.tab}
          aria-current={tab.key === 'all' ? 'page' : undefined}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
