'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { getMyProfile, updateMyProfile } from '@linker/api/p05-profile-edit/p05-profile-edit';
import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import type { SettingsData } from '../_lib/settings-types';
import { SettingsArrowButton, SettingsCommon } from './SettingsCommon';
import styles from './settings-view.module.css';

const JOB_STATUS_LABEL = { SEEKING: '구직 중', OPEN: '제안 받기', OFF: '구직 안 함' } as const;

export function DeveloperSettingsView({
  login,
  settings,
  jobStatus,
  blockCount,
}: {
  login: string;
  settings: SettingsData;
  jobStatus: keyof typeof JOB_STATUS_LABEL;
  blockCount: number;
}) {
  const jobStatusOverlay = useOverlay('profile-edit-job');
  const [appliedJobStatus, setAppliedJobStatus] = useState(jobStatus);
  const [selectedJobStatus, setSelectedJobStatus] = useState(jobStatus);
  const saveJobStatus = useMutation({
    mutationFn: async (next: keyof typeof JOB_STATUS_LABEL) => {
      const profile = await getMyProfile();
      return updateMyProfile({
        name: profile.name,
        bio: profile.bio,
        blogUrl: profile.blogUrl,
        techStack: profile.techStack,
        lookingForTeam: profile.lookingForTeam,
        jobStatus: next,
        jobCategories: profile.jobCategories,
      });
    },
    onSuccess: (saved, next) => {
      setAppliedJobStatus(isJobStatus(saved.jobStatus) ? saved.jobStatus : next);
      jobStatusOverlay.close();
    },
    onError: () => toast('구직 상태를 저장하지 못했어요. 다시 시도해 주세요.', { tone: 'error' }),
  });

  function openJobStatus() {
    setSelectedJobStatus(appliedJobStatus);
    jobStatusOverlay.open();
  }

  return (
    <>
      <SettingsCommon
        login={login}
        settings={settings}
        blockCount={blockCount}
        accountStart={
          <div className={styles.row}>
            <h2 className={styles.rowLabel}>GitHub 연결</h2>
            <span className={styles.trailing}>
              {settings.github?.connected ? (
                <span className={styles.connected}><span className={styles.dot} aria-hidden="true" />연결 됨</span>
              ) : (
                <span className={styles.value}>연결 안 됨</span>
              )}
            </span>
          </div>
        }
        personal={
          <div className={styles.row}>
            <span>구직 상태</span>
            <span className={styles.trailing}>
              <span className={appliedJobStatus === 'SEEKING' ? styles.connected : styles.value}>{JOB_STATUS_LABEL[appliedJobStatus]}</span>
              <SettingsArrowButton label="구직 상태" onClick={openJobStatus} />
            </span>
          </div>
        }
      />
      <OverlaySheet
        overlay={jobStatusOverlay}
        title="구직 상태"
        description="구직 상태를 선택해 주세요."
        describeHidden
        classNames={{
          scrim: styles.jobStatusScrim,
          sheet: styles.jobStatusSheet,
          title: styles.jobStatusTitle,
          close: styles.jobStatusClose,
        }}
      >
        <div className={styles.jobStatusContent}>
          <div className={styles.jobStatusOptions} role="radiogroup" aria-label="구직 상태">
            {JOB_STATUS_OPTIONS.map((option) => (
              <label className={styles.jobStatusOption} data-selected={selectedJobStatus === option.value} key={option.value}>
                <input
                  className="sr-only"
                  type="radio"
                  value={option.value}
                  checked={selectedJobStatus === option.value}
                  onChange={() => setSelectedJobStatus(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
          <button
            type="button"
            className={styles.jobStatusDone}
            disabled={saveJobStatus.isPending}
            onClick={() => saveJobStatus.mutate(selectedJobStatus)}
          >
            {saveJobStatus.isPending ? '저장 중…' : '완료'}
          </button>
        </div>
      </OverlaySheet>
    </>
  );
}

function isJobStatus(value: string | undefined): value is keyof typeof JOB_STATUS_LABEL {
  return value === 'SEEKING' || value === 'OPEN' || value === 'OFF';
}

const JOB_STATUS_OPTIONS = [
  { value: 'SEEKING', label: '구직 중' },
  { value: 'OPEN', label: '제안 받기' },
  { value: 'OFF', label: '구직 안 함' },
] as const;

