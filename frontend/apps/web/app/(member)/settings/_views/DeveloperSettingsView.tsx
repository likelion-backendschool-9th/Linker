'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { updateMyProfile } from '@linker/api/p05-profile-edit/p05-profile-edit';
import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import type { SettingsData } from '../_lib/settings-types';
import { SettingsCommon } from './SettingsCommon';
import styles from './settings-view.module.css';

const JOB_STATUS_LABEL = { SEEKING: '구직 중', OPEN: '제안만 받기', OFF: '끔' } as const;

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
  const router = useRouter();
  const jobStatusOverlay = useOverlay('profile-edit-job');
  const [selectedJobStatus, setSelectedJobStatus] = useState(jobStatus);
  const saveJobStatus = useMutation({
    mutationFn: () => updateMyProfile({ jobStatus: selectedJobStatus }),
    onSuccess: () => {
      jobStatusOverlay.close();
      router.refresh();
    },
    onError: () => toast('구직 상태를 저장하지 못했어요. 다시 시도해 주세요.', { tone: 'error' }),
  });

  function openJobStatus() {
    setSelectedJobStatus(jobStatus);
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
          <button type="button" className={styles.row} onClick={openJobStatus}>
            <span>구직 상태</span>
            <span className={styles.trailing}><span className={jobStatus === 'SEEKING' ? styles.connected : styles.value}>{JOB_STATUS_LABEL[jobStatus]}</span><Chevron /></span>
          </button>
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
            onClick={() => saveJobStatus.mutate()}
          >
            {saveJobStatus.isPending ? '저장 중…' : '완료'}
          </button>
        </div>
      </OverlaySheet>
    </>
  );
}

const JOB_STATUS_OPTIONS = [
  { value: 'SEEKING', label: '구직 진행 중' },
  { value: 'OPEN', label: '제안만 받기' },
  { value: 'OFF', label: '끔' },
] as const;

function Chevron() {
  return <span className={styles.chevron} aria-hidden="true" />;
}
