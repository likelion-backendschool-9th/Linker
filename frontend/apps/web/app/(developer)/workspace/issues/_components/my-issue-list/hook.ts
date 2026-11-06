'use client';

import { useQuery } from '@tanstack/react-query';

import { myIssuesOptions } from './api';

export function useMyIssueList() {
  return useQuery(myIssuesOptions());
}
