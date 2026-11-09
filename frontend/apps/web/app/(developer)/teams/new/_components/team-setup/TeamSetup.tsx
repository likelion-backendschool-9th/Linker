'use client';

import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button/Button';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import styles from '@/features/teams/team-ui.module.css';
import { TEAM } from '@/lib/policy';
import { TeamSetupOutcome } from '../team-setup-outcome';
import { TeamSetupIntro } from '../team-setup-intro/TeamSetupIntro';
import { TeamSetupInformation } from '../team-setup-information/TeamSetupInformation';
import { TeamSetupRepositories } from '../team-setup-repositories/TeamSetupRepositories';
import { STEPS, useTeamSetup } from './hook';
import { TeamSetupBoards } from '../team-setup-boards/TeamSetupBoards';

export function TeamSetup() {
  const {
    step,
    setStep,
    installed,
    setupTeamId,
    create,
    setName,
    setNameTouched,
    description,
    setDescription,
    previewTeamId,
    selectPreviewTeam,
    selectedRepos,
    setSelectedRepos,
    completePreview,
    setCompletePreview,
    boardDraft,
    setBoardDraft,
    teams,
    ownedTeams,
    previewSettings,
    previewTeam,
    permission,
    displayName,
    boardSummary,
    atLimit,
    openExternal,
  } = useTeamSetup();

  if (step === 1)
    return <TeamSetupIntro teams={teams} atLimit={atLimit} openExternal={openExternal} />;

  if (step === 2)
    return (
      <TeamSetupInformation
        installed={installed}
        name={displayName}
        description={description}
        onNameChange={(value) => {
          setName(value);
          setNameTouched(true);
        }}
        onDescriptionChange={setDescription}
        onNext={() => {
          if (!create.isPending) create.mutate();
        }}
        pending={create.isPending}
        error={create.error}
        openExternal={openExternal}
      />
    );

  if (step === 3)
    return (
      <TeamSetupRepositories
        teamId={setupTeamId}
        selected={selectedRepos}
        onChange={setSelectedRepos}
        onNext={() => void setStep(4, { history: 'push' })}
        openExternal={openExternal}
      />
    );

  if (step === 4)
    return (
      <TeamSetupBoards
        key={setupTeamId}
        teamId={setupTeamId}
        value={boardDraft}
        onChange={setBoardDraft}
        onSaved={() => void setStep(5, { history: 'push' })}
      />
    );

  return (
    <div className={styles.stack}>
      <nav aria-label="팀 만들기 단계">
        <ol className={styles.steps}>
          {STEPS.map((label, index) => (
            <li key={label}>
              <button
                type="button"
                className={styles.step}
                aria-current={step === index + 1 ? 'step' : undefined}
                onClick={() => void setStep(index + 1, { history: 'push' })}
              >
                <span className={styles.stepNumber}>{index + 1}</span>
                {label}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <p className={styles.description}>
        화면 미리보기예요. GitHub 연결과 팀 생성은 아직 실행되지 않아요.
      </p>
      {atLimit && (
        <p className={styles.soft}>
          팀은 {TEAM.maxTeamsPerUser}개까지 참여할 수 있어요. 보관된 팀은 제외해요.
        </p>
      )}
      <details className={styles.soft}>
        <summary>연결된 팀으로 선택 화면 미리보기</summary>
        <p className={styles.description}>
          내가 오너인 기존 팀의 조회 데이터로 레포·보드 선택 UI만 확인해요. 기존 팀은 변경하지
          않아요.
        </p>
        {teams.isError ? (
          <ErrorState onRetry={() => void teams.refetch()} />
        ) : (
          <div className={styles.field}>
            <label htmlFor="setup-preview-team">미리보기에 사용할 팀</label>
            <select
              id="setup-preview-team"
              className={styles.select}
              value={previewTeamId}
              onChange={(event) => selectPreviewTeam(event.target.value)}
            >
              <option value="">팀을 선택해 주세요</option>
              {ownedTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </details>
      {previewSettings.isError && (
        <ErrorState
          title="미리보기 팀을 불러오지 못했어요"
          onRetry={() => void previewSettings.refetch()}
        />
      )}
      <section className={`${styles.card} ${styles.stack}`} aria-labelledby="setup-step-title">
        {step === 5 && (
          <>
            <div className={styles.heroIcon}>
              <ShieldCheck aria-hidden />
            </div>
            <h2 id="setup-step-title" className={styles.title}>
              설정 내용을 확인해 주세요
            </h2>
            <dl className={styles.details}>
              <div>
                <dt>팀 이름</dt>
                <dd>{displayName.trim() || '입력하지 않았어요'}</dd>
              </div>
              <div>
                <dt>팀 소개</dt>
                <dd>{description.trim() || '입력하지 않았어요'}</dd>
              </div>
              <div>
                <dt>GitHub 조직</dt>
                <dd>
                  {previewTeam
                    ? `${previewTeam.orgLogin} · 기존 팀 미리보기`
                    : '아직 연결하지 않았어요'}
                </dd>
              </div>
              <div>
                <dt>선택한 레포</dt>
                <dd>{selectedRepos.length}개</dd>
              </div>
              <div>
                <dt>프로젝트 보드</dt>
                <dd>{boardSummary}</dd>
              </div>
            </dl>
            {(!previewTeam || permission.data?.basePermission === 'READ') && (
              <p className={styles.soft}>
                팀원이 이슈에 담당자·라벨을 정하려면 쓰기 권한이 필요해요
              </p>
            )}
            {previewTeam && permission.isPending && <Skeleton />}
            {previewTeam && permission.isError && (
              <ErrorState
                title="기본 레포 권한을 확인하지 못했어요"
                onRetry={() => void permission.refetch()}
              />
            )}
            {permission.data?.basePermission === 'WRITE' && (
              <p className={styles.description}>조직의 기본 레포 권한이 쓰기로 설정돼 있어요.</p>
            )}
            {previewTeam && permission.data && (
              <Button variant="outline" onClick={() => openExternal(permission.data.settingsUrl)}>
                GitHub 권한 설정 보기
              </Button>
            )}
            <Button disabled aria-describedby="create-notice">
              팀 만들기
            </Button>
            <p id="create-notice" className={styles.description}>
              현재는 입력 화면을 미리 볼 수 있어요. 팀 생성 기능은 준비 중이에요.
            </p>
            <Button asChild variant="outline">
              <Link href="/workspace">워크스페이스로 가기</Link>
            </Button>
            <Button
              variant="soft"
              aria-expanded={completePreview}
              onClick={() => setCompletePreview(!completePreview)}
            >
              생성 완료 화면 미리보기
            </Button>
          </>
        )}
      </section>
      {step === 5 && completePreview && (
        <TeamSetupOutcome state="COMPLETE" teamId={previewTeamId || undefined} />
      )}
      <Button asChild variant="soft">
        <Link href="/teams/new/callback">설치 결과 화면 미리보기</Link>
      </Button>
      <div className={styles.footer}>
        <Button variant="outline" disabled={step === 1} onClick={() => void setStep(step - 1)}>
          <ArrowLeft aria-hidden />
          이전
        </Button>
        {step < STEPS.length && (
          <Button onClick={() => void setStep(step + 1, { history: 'push' })}>
            다음
            <ArrowRight aria-hidden />
          </Button>
        )}
      </div>
      <Button asChild variant="soft">
        <Link href={'/recruits' as Route}>팀 찾으러 가기</Link>
      </Button>
    </div>
  );
}
