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
  // Keep the compact onboarding set in its displayed order and use canonical
  // API names so selection is submitted correctly.
  const suggestions = [
    { name: 'Java', label: 'Java' },
    { name: 'Next.js', label: 'Next.js' },
    { name: 'TypeScript', label: 'TypeScript' },
    { name: 'Figma', label: 'Figma' },
    { name: 'Spring Boot', label: 'Spring' },
    { name: 'Node.js', label: 'node.js' },
    { name: 'Kubernetes', label: 'kubernetes' },
    { name: 'React', label: 'React' },
    { name: 'React Native', label: 'React Native' },
  ];
  const tagByName = new Map(tags.map((tag) => [tag.name, tag]));
  const visibleTags = suggestions.flatMap(({ name, label }) => {
    const tag = tagByName.get(name);
    return tag ? [{ ...tag, label }] : [];
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
