'use client';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';

import type { ChatReferenceControl } from '../_hooks/use-chat-references';
import styles from './chat-room.module.css';

type Props = { control: ChatReferenceControl; onMention: (login: string) => void };
export function ChatReferenceTools({ control: c, onMention }: Props) {
  const pickerNumber = Number(c.picker.id);
  const candidates = c.candidates.data?.items.filter((member) =>
    !c.active || `${member.name} ${member.login}`.toLocaleLowerCase('ko').includes(c.active.search.toLocaleLowerCase('ko')),
  ) ?? [];
  return (
    <>
      {c.active && (
        <section aria-label="멘션 추천" id="chat-mention-suggestions" className={styles.referenceTools}>
          {c.candidates.isPending ? <p role="status">팀원을 불러오고 있어요.</p> :
            c.candidates.isError ? <ErrorState title="멘션 후보를 불러오지 못했어요" onRetry={() => { void c.candidates.refetch(); }} /> : (
              <ul>
                {c.canAll && ['전체', 'all'].some((name) => name.startsWith(c.active!.search)) && <li><Button variant="soft" onClick={() => onMention('전체')}>@전체</Button></li>}
                {candidates.map((member) => <li key={member.id}><Button variant="soft" onClick={() => onMention(member.login)}>{member.name} (@{member.login})</Button></li>)}
                {!candidates.length && !c.canAll && <li>일치하는 팀원이 없어요.</li>}
              </ul>
            )}
        </section>
      )}
      {!c.active && c.candidates.isError && <ErrorState title="멘션 후보를 불러오지 못했어요" onRetry={() => { void c.candidates.refetch(); }} />}
      {c.forbiddenAll && <p role="alert" className={styles.error}>@전체는 팀 오너와 관리자만 사용할 수 있어요.</p>}
      {c.numbers.length > 0 && (
        <section aria-label="연결할 이슈" className={styles.referenceTools}>
          {c.repos.isPending ? <p role="status">저장소를 불러오고 있어요.</p> : c.repos.isError ?
            <ErrorState title="저장소를 불러오지 못했어요" onRetry={() => { void c.repos.refetch(); }} /> :
            !c.repos.data?.repos.length ? <p role="alert">연결된 저장소가 없어요. 이슈 번호를 지우거나 저장소 연결을 확인해 주세요.</p> :
            c.numbers.map((number, index) => (
              <div key={number}>
                {c.repos.data!.repos.length > 1 && <Button variant="outline" onClick={() => c.picker.open(String(number))}>#{number} 저장소 {c.getRepo(number) ? '변경' : '선택'}</Button>}
                {c.getRepo(number) !== null && (c.cards[index]!.isPending ? <p role="status">#{number} 확인 중…</p> : c.cards[index]!.isError ?
                  <ErrorState title={`#${number} 이슈를 확인하지 못했어요`} description="저장소를 바꾸거나 이슈 번호를 지운 뒤 다시 시도해 주세요." onRetry={() => { void c.cards[index]!.refetch(); }} /> :
                  <p>{c.cards[index]!.data!.canView ? `${c.cards[index]!.data!.repoName} #${number} · ` : ''}{c.cards[index]!.data!.title}</p>)}
              </div>
            ))}
        </section>
      )}
      <OverlaySheet overlay={c.picker} title="저장소 선택" description={`#${pickerNumber} 이슈가 있는 저장소를 선택해 주세요.`}>
        {c.numbers.includes(pickerNumber) && c.repos.data ? <ul>{c.repos.data.repos.map((repo) => <li key={repo.id}><Button variant="soft" onClick={() => c.chooseRepo(pickerNumber, repo.id)}>{repo.name}</Button></li>)}</ul> : <p>연결할 이슈 번호를 확인해 주세요.</p>}
      </OverlaySheet>
    </>
  );
}
