'use client';

import { Button } from '@/components/ui/button';
import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import styles from './tech-tag-picker.module.css';

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
  return (
    <OverlaySheet
      overlay={overlay}
      title="기술 스택 선택"
      description={`최대 ${max}개까지 선택할 수 있어요.`}
    >
      <ul className={styles.list}>
        {tags.map((tag) => {
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
                <span>{tag.name}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <Button block onClick={overlay.close}>
        선택 완료
      </Button>
    </OverlaySheet>
  );
}
