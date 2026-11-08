'use client';

import { useRecruitHeaderCollapse } from './hook';

/** Isolates the scroll-top latch side effect so RecruitList itself stays a Server Component. */
export function RecruitHeaderCollapseEffect() {
  useRecruitHeaderCollapse();
  return null;
}
