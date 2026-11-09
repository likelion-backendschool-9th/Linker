'use client';

import type { MyTeamsResponse } from '@linker/api/openAPIDefinition.schemas';
import type { UseQueryResult } from '@tanstack/react-query';
import Image from 'next/image';

import { ErrorState } from '@/components/ui/error-state/ErrorState';

import { useTeamInstall } from './hook';
import styles from './TeamSetupIntro.module.css';

const BENEFITS = [
  '조직의 정보와 멤버를 안전하게 불러와요',
  '선택한 저장소만 팀과 연결할 수 있어요',
  '기존 작업 흐름은 그대로, 협업은 더 쉽게 할 수 있어요',
] as const;

type TeamSetupIntroProps = {
  teams: UseQueryResult<MyTeamsResponse, unknown>;
  atLimit: boolean;
  openExternal: (url: string) => void;
};

/** Main screen of Figma 8 (142:73); successful installation is verified later on the callback. */
export function TeamSetupIntro({ teams, atLimit, openExternal }: TeamSetupIntroProps) {
  const install = useTeamInstall();
  const disabled = teams.isPending || teams.isError || atLimit || install.isPending;
  return (
    <div className={styles.intro}>
      <section className={styles.content} aria-labelledby="setup-intro-title">
        <Image
          src="/images/team-setup/github.svg"
          alt=""
          width={48}
          height={48}
          className={styles.mark}
        />
        <h2 id="setup-intro-title" className={styles.headline}>
          GitHub 조직을 연동하고 팀을 만드세요
        </h2>
        <p className={styles.description}>
          링커는 깃허브 조직 1개를 팀 1개로 사용해요.
          <br />
          링커를 조직에 설치하면 멤버와 저장소를 불러오실 수 있어요.
        </p>
        <ul className={styles.benefits}>
          {BENEFITS.map((benefit) => (
            <li key={benefit}>
              <Image src="/images/team-setup/check.svg" alt="" width={18} height={18} />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </section>
      {teams.isError && <ErrorState onRetry={() => void teams.refetch()} />}
      <div className={styles.footer}>
        <div className={styles.connectActions}>
          <a
            href="https://github.com/organizations/plan"
            className={styles.organizationLink}
            onClick={(event) => {
              event.preventDefault();
              openExternal(event.currentTarget.href);
            }}
          >
            GitHub 조직 생성하기
          </a>
          <button
            type="button"
            className={styles.install}
            disabled={disabled}
            aria-busy={install.isPending}
            aria-describedby={atLimit ? 'setup-team-limit' : undefined}
            onClick={() => install.mutate()}
          >
            GitHub로 시작하기
          </button>
          {atLimit && (
            <p id="setup-team-limit" className="sr-only">
              팀은 {teams.data?.teamLimit}개까지 참여할 수 있어요. 보관된 팀은 제외해요.
            </p>
          )}
        </div>
        <button type="button" className={styles.next} disabled>
          다음
        </button>
      </div>
    </div>
  );
}
