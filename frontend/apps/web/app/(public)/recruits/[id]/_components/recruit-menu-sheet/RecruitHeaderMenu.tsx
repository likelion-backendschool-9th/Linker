'use client';

// Client boundary: the stack header's "더보기" reads the same cached post as the body
import { useQuery } from '@tanstack/react-query';

import { useViewer } from '@/lib/auth/viewer-context';

import { recruitDetailOptions } from '../../_lib/detail-queries';
import { RecruitMenuSheet } from './RecruitMenuSheet';

/** Header action of 21 (Figma 92:578): the menu moved from the title row up to the app bar */
export function RecruitHeaderMenu({ recruitId }: { recruitId: string }) {
  const viewer = useViewer();
  const { data: recruit } = useQuery(recruitDetailOptions(viewer.login, recruitId));
  if (!recruit) return null;
  return <RecruitMenuSheet recruit={recruit} />;
}
