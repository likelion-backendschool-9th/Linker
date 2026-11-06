'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { jobCategoriesOptions } from '@/features/job-categories/job-category-queries';
import { ApiError } from '@/lib/api/api-error';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { getMyJobAd, RECRUITER_JOB_AD_QUERY_KEY, saveMyJobAd, updateMyJobAdStatus } from './api';

export function useRecruiterAdPanel() {
  const queryClient = useQueryClient();
  const sheet = useOverlay('recruiter-ad');
  const categories = useQuery(jobCategoriesOptions());
  const ad = useQuery({
    queryKey: RECRUITER_JOB_AD_QUERY_KEY,
    queryFn: getMyJobAd,
  });
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: saveMyJobAd,
    onSuccess: async (saved) => {
      queryClient.setQueryData(RECRUITER_JOB_AD_QUERY_KEY, saved);
      setError('');
      sheet.close();
    },
    onError: (cause) => setError(cause instanceof ApiError ? cause.message : '광고를 저장하지 못했어요.'),
  });

  const toggle = useMutation({
    mutationFn: updateMyJobAdStatus,
    onSuccess: (saved) => queryClient.setQueryData(RECRUITER_JOB_AD_QUERY_KEY, saved),
    onError: (cause) => setError(cause instanceof ApiError ? cause.message : '광고 상태를 바꾸지 못했어요.'),
  });

  return { ad, categories, sheet, error, save, toggle };
}
