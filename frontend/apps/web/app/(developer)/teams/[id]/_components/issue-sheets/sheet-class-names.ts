import teamChange from '../../../../_components/team-change-sheet/TeamChangeSheet.module.css';

/**
 * The four issue sheets (12; reused by 13, 15) have no Figma screen of their own: they take the look of
 * 11's "팀 변경" sheet (scrim, rounded sheet, title). Needs the 12 reviewer's check.
 */
export const sheetClassNames = {
  scrim: teamChange.scrim,
  sheet: teamChange.sheet,
  title: teamChange.title,
};
