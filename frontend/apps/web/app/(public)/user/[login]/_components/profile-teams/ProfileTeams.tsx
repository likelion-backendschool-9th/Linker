'use client';

import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button/Button';

import styles from '../profile.module.css';
import { useProfileTeams } from './hook';

const TEAM_STATUS = {
  ACTIVE: '활동 중',
  COMPLETED: '완료',
} as const;

export function ProfileTeams({
  login,
  status,
  embedded = false,
}: {
  login: string;
  status?: 'ACTIVE' | 'COMPLETED';
  embedded?: boolean;
}) {
  const teams = useProfileTeams(login);
  const items = teams.data?.items.filter((team) => (status ? team.status === status : true));

  return (
    <section className={embedded ? styles.embeddedWork : styles.section} aria-labelledby="teams-title">
      <h2 id="teams-title" className={embedded ? 'sr-only' : undefined}>
        함께한 팀
      </h2>
      {teams.isPending ? (
        <p role="status">팀을 불러오고 있어요.</p>
      ) : teams.isError ? (
        <div>
          <p role="alert">팀을 불러오지 못했어요.</p>
          <Button variant="outline" onClick={() => void teams.refetch()}>
            다시 시도
          </Button>
        </div>
      ) : !items || items.length === 0 ? (
        <p className={embedded && status === 'ACTIVE' ? `${styles.empty} ${styles.emptyCentered}` : styles.empty}>
          {embedded && status === 'ACTIVE' ? '진행중인 프로젝트가 없어요' : '함께한 팀이 없어요'}
        </p>
      ) : (
        <ul className={embedded ? styles.workGrid : styles.teamList}>
          {items.map((team) => (
            <li key={team.id}>
              {embedded ? (
                <Link className={styles.workCard} href={`/teams/${team.id}/issues` as Route}>
                  <span className={styles.workCover}>
                    {team.orgAvatarUrl && (
                      <Image src={team.orgAvatarUrl} alt="" fill sizes="164px" />
                    )}
                  </span>
                  <span className={styles.workTitle}>{team.name}</span>
                  <span className="sr-only">{TEAM_STATUS[team.status]}</span>
                </Link>
              ) : (
                <Link className={styles.teamLink} href={`/teams/${team.id}/issues` as Route}>
                  <span className={styles.teamMark}>
                    {team.orgAvatarUrl && (
                      <Image src={team.orgAvatarUrl} alt="" fill sizes="44px" />
                    )}
                  </span>
                  <span className={styles.teamName}>{team.name}</span>
                  <span className={styles.badge}>{TEAM_STATUS[team.status]}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
