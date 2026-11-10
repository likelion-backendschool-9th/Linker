import type { RecruitListTab } from '../../_lib/list-queries';
import styles from './RecruitTabs.module.css';

const TABS: { key: RecruitListTab; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'mine', label: '내 모집글' },
  { key: 'applied', label: '내 지원' },
];

/** 19 recruit list tabs (Figma 254:2174): 전체/내 모집글/내 지원 */
export function RecruitTabs({
  tab,
  onSelect,
}: {
  tab: RecruitListTab;
  onSelect: (tab: RecruitListTab) => void;
}) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="모집 목록">
      {TABS.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          className={styles.tab}
          aria-selected={tab === item.key}
          aria-current={tab === item.key ? 'page' : undefined}
          onClick={() => onSelect(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
