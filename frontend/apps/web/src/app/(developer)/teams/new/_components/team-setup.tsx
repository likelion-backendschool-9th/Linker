'use client';

// client boundary: local form preview and URL steps; no team creation or GitHub writes
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GitBranch,
  LayoutList,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { parseAsInteger, useQueryState } from 'nuqs';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpenExternal } from '@/features/external-link/use-open-external';
import { GitHubMark as Github } from '@/features/github/github-mark';
import styles from '@/features/teams/team-ui.module.css';
import { TEAM } from '@/lib/policy';
import { myTeamsOptions } from '../../[id]/_lib/team-queries';
import { TeamRepoSelection } from '../../_components/team-repo-selection';
import { TeamBoardSelection, type BoardSelection } from '../../_components/team-board-selection';
import {
  setupBoardsOptions,
  setupReposOptions,
  setupPermissionOptions,
} from '../../_lib/setup-queries';
import { TeamSetupOutcome } from './team-setup-outcome';
import { settingsOptions } from '../../[id]/settings/_lib/settings-queries';

const STEPS = ['GitHub 연결', '팀 정보', '레포 연결', '보드 연결', '확인'];
const STATUSES = [
  '작업 전 · Todo',
  '작업 중 · In Progress',
  '작업 중단 · Blocked',
  '작업 완료 · Done',
];

export function TeamSetup() {
  const [value, setStep] = useQueryState('step', parseAsInteger.withDefault(1));
  const step = Math.min(STEPS.length, Math.max(1, value));
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [previewTeamId, setPreviewTeamId] = useState('');
  const [selectedRepos, setSelectedRepos] = useState<number[]>([]);
  const [completePreview, setCompletePreview] = useState(false);
  const [boardDraft, setBoardDraft] = useState<BoardSelection>({
    mode: 'new',
    boardId: '',
    statusMapping: {},
  });
  const teams = useQuery(myTeamsOptions());
  const ownedTeams =
    teams.data?.items.filter((team) => team.myRole === 'OWNER' && team.status === 'ACTIVE') ?? [];
  const previewSource = ownedTeams.find((team) => String(team.id) === previewTeamId);
  const previewSettings = useQuery({ ...settingsOptions(previewTeamId), enabled: !!previewSource });
  const previewTeam = previewSettings.data;
  const repos = useQuery({
    ...setupReposOptions(previewTeamId),
    enabled: !!previewTeam && step === 3,
  });
  const boards = useQuery({
    ...setupBoardsOptions(previewTeamId),
    enabled: !!previewTeam && step === 4,
  });
  const permission = useQuery({
    ...setupPermissionOptions(previewTeamId),
    enabled: !!previewTeam && step === 5,
  });
  const displayName = nameTouched ? name : (previewTeam?.orgLogin ?? '');
  const boardSummary =
    boardDraft.mode === 'new'
      ? '새 Linker 보드'
      : (boards.data?.items.find((board) => board.id === boardDraft.boardId)?.name ?? '기존 보드');
  const atLimit =
    (teams.data?.items.filter((team) => team.status !== 'ARCHIVED').length ?? 0) >=
    TEAM.maxTeamsPerUser;
  const openExternal = useOpenExternal();

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
              onChange={(event) => {
                setPreviewTeamId(event.target.value);
                setSelectedRepos([]);
                setBoardDraft({ mode: 'new', boardId: '', statusMapping: {} });
              }}
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
        {step === 1 && (
          <>
            <div className={styles.heroIcon}>
              <Github aria-hidden />
            </div>
            <h2 id="setup-step-title" className={styles.title}>
              GitHub 조직과 팀을 연결해요
            </h2>
            <p>GitHub 조직 1개 = 팀 1개</p>
            <p className={styles.description}>
              Linker 앱을 설치하고 레포와 프로젝트 보드를 연결하면 팀의 이슈와 PR을 한곳에서 볼 수
              있어요.
            </p>
            <ul className={styles.list}>
              <li className={styles.row}>
                <Users aria-hidden />
                조직 멤버와 함께 협업해요
              </li>
              <li className={styles.row}>
                <GitBranch aria-hidden />
                선택한 레포의 이슈와 PR을 모아요
              </li>
              <li className={styles.row}>
                <LayoutList aria-hidden />
                하나의 프로젝트 보드로 일정을 관리해요
              </li>
            </ul>
            <div className={styles.actions}>
              <Button disabled aria-describedby="install-notice">
                <Github aria-hidden />
                GitHub에서 설치하기
              </Button>
              <Button
                variant="outline"
                onClick={() => openExternal('https://github.com/organizations/plan')}
              >
                조직이 없어요
              </Button>
            </div>
            <p id="install-notice" className={styles.description}>
              앱 설치 기능은 준비 중이에요. 다음 단계에서 입력 화면을 미리 볼 수 있어요.
            </p>
            <div className={styles.soft}>
              <p>GitHub 조직 오너만 앱을 설치할 수 있어요. 오너에게 설치를 요청할까요?</p>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h2 id="setup-step-title" className={styles.title}>
              팀을 소개해 주세요
            </h2>
            <p className={styles.description}>
              팀원들이 알아볼 이름과 함께할 프로젝트를 적어 주세요.
            </p>
            <div className={styles.field}>
              <label htmlFor="team-name">팀 이름</label>
              <input
                id="team-name"
                className={styles.input}
                value={displayName}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameTouched(true);
                }}
                placeholder={previewTeam?.orgLogin ?? '팀 이름을 입력해 주세요'}
                autoComplete="organization"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="team-description">팀 소개</label>
              <textarea
                id="team-description"
                className={styles.textarea}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="함께 만드는 프로젝트를 소개해 주세요"
              />
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <h2 id="setup-step-title" className={styles.title}>
              함께 작업할 레포를 선택해요
            </h2>
            <p className={styles.description}>
              Linker 앱이 설치된 레포만 연결할 수 있어요. 연결할 수 있는 레포 수에는 제한이 없어요.
            </p>
            {!previewTeam ? (
              <EmptyState
                title="GitHub 조직을 먼저 연결해 주세요."
                description="연결을 마치면 접근이 허용된 레포가 여기에 표시돼요."
              />
            ) : repos.isPending ? (
              <Skeleton />
            ) : repos.isError ? (
              <ErrorState onRetry={() => void repos.refetch()} />
            ) : (
              <>
                <TeamRepoSelection
                  repos={repos.data.items}
                  selected={selectedRepos}
                  onChange={setSelectedRepos}
                />
                <p className={styles.description}>
                  선택한 레포 {selectedRepos.length}개 · 접근이 허용되지 않은 레포{' '}
                  {repos.data.notInstalledCount}개
                </p>
              </>
            )}
            <Button
              variant="outline"
              disabled={!previewTeam}
              onClick={() =>
                openExternal(
                  `https://github.com/organizations/${previewTeam?.orgLogin}/settings/installations`,
                )
              }
            >
              GitHub에서 접근 허용하기
            </Button>
          </>
        )}
        {step === 4 && (
          <>
            <h2 id="setup-step-title" className={styles.title}>
              프로젝트 보드를 연결해요
            </h2>
            <p className={styles.description}>
              팀마다 하나의 보드를 사용해요. 나중에 팀 설정에서 바꿀 수 있어요.
            </p>
            {previewTeam ? (
              boards.isPending ? (
                <Skeleton />
              ) : boards.isError ? (
                <ErrorState onRetry={() => void boards.refetch()} />
              ) : (
                <TeamBoardSelection
                  key={previewTeamId}
                  boards={boards.data.items}
                  value={boardDraft}
                  onChange={setBoardDraft}
                />
              )
            ) : (
              <>
                <fieldset className={styles.section}>
                  <legend className={styles.label}>연결 방식</legend>
                  <label className={styles.choice}>
                    <input type="radio" name="board-mode" defaultChecked />
                    새로 만들기
                  </label>
                  <label className={styles.choice}>
                    <input type="radio" name="board-mode" disabled />
                    기존 보드 쓰기 · GitHub 연결 후 선택
                  </label>
                </fieldset>
                <div className={styles.soft}>
                  <h3 className={styles.cardTitle}>Linker</h3>
                  <p className={styles.description}>Status · Start date · Due date</p>
                  <ul className={styles.list}>
                    {STATUSES.map((status) => (
                      <li key={status} className={styles.row}>
                        <Check size={16} aria-hidden />
                        {status}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </>
        )}
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
