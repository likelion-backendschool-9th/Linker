import type { ComponentProps } from 'react';

import type { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';

import styles from './issue-sheets.module.css';

type SheetClassNames = ComponentProps<typeof OverlaySheet>['classNames'];

/** Chrome of the four Figma 13 sheets (368:2186, 368:2309, 368:2440, 368:2615). */
export const sheetClassNames = {
  sheet: `${styles.sheet} ${styles.sheet}`,
  header: `${styles.header} ${styles.header}`,
  title: `${styles.title} ${styles.title}`,
  close: `${styles.close} ${styles.close}`,
  body: `${styles.body} ${styles.body}`,
} satisfies SheetClassNames;

/** The date sheet (368:2615) fills the whole sheet with #f9f9f9. */
export const dateSheetClassNames = {
  ...sheetClassNames,
  sheet: `${styles.dateSheet} ${styles.dateSheet}`,
  body: `${styles.body} ${styles.dateBody}`,
} satisfies SheetClassNames;
