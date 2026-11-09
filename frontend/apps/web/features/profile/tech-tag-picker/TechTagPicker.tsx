'use client';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import styles from './TechTagPicker.module.css';

export type TechTagOption = { id: number; name: string };

export function TechTagPicker({
  overlay,
  tags,
  selected,
  max,
  onToggle,
}: {
  overlay: OverlayControl;
  tags: TechTagOption[];
  selected: string[];
  max: number;
  onToggle: (name: string) => void;
}) {
  // Keep the documented stack suggestions in their category order and use
  // canonical API names so selection is submitted correctly.
  const suggestions = [
    { name: 'TypeScript', label: 'TypeScript' },
    { name: 'React', label: 'React' },
    { name: 'Next.js', label: 'Next.js' },
    { name: 'Expo', label: 'Expo' },
    { name: 'React Native', label: 'React Native' },
    { name: 'Java', label: 'Java' },
    { name: 'Spring Boot', label: 'Spring Boot' },
    { name: 'Spring Security', label: 'Spring Security' },
    { name: 'JPA', label: 'JPA' },
    { name: 'PostgreSQL', label: 'PostgreSQL' },
    { name: 'Redis', label: 'Redis' },
    { name: 'WebSocket', label: 'WebSocket' },
    { name: 'STOMP', label: 'STOMP' },
    { name: 'CSS Modules', label: 'CSS Modules' },
    { name: 'TanStack Query', label: 'TanStack Query' },
    { name: 'Docker', label: 'Docker' },
    { name: 'Nginx', label: 'Nginx' },
    { name: 'Figma', label: 'Figma' },
    { name: 'Node.js', label: 'node.js' },
    { name: 'Kubernetes', label: 'kubernetes' },
  ];
  const tagByName = new Map(tags.map((tag) => [tag.name, tag]));
  const included = new Set<string>();
  const visibleTags = suggestions.flatMap(({ name, label }) => {
    const tag = tagByName.get(name);
    if (!tag || included.has(tag.name)) return [];
    included.add(tag.name);
    return [{ ...tag, label }];
  });

  return (
    <OverlaySheet
      overlay={overlay}
      title="기술 스택"
      description={`최대 ${max}개까지 선택할 수 있어요.`}
      describeHidden
      classNames={{
        scrim: styles.scrim,
        sheet: styles.sheet,
        header: styles.header,
        title: styles.title,
        close: styles.close,
        body: styles.body,
      }}
    >
      <div className={styles.content}>
        <ul className={styles.list} aria-label="기술 스택 목록">
          {visibleTags.map((tag) => {
            const checked = selected.includes(tag.name);
            return (
              <li key={tag.id}>
                <label className={styles.option}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && selected.length >= max}
                    onChange={() => onToggle(tag.name)}
                  />
                  <span>{tag.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <button type="button" className={styles.done} onClick={overlay.close}>
          완료
        </button>
      </div>
    </OverlaySheet>
  );
}
