import Link from 'next/link';

import type { ChatIssueCard } from '../../_lib/chat-reference-types';
import styles from '../chat-room/ChatRoom.module.css';

const STATUS = { TODO: '할 일', IN_PROGRESS: '진행 중', BLOCKED: '막힘', DONE: '완료', OTHER: '기타' };
export function IssueMessageCards({ cards }: { cards: ChatIssueCard[] }) {
  return (
    <ul className={styles.issueCards} aria-label="연결된 이슈">
      {cards.map((card, index) => <li key={index} className={styles.card}>
        {card.canView ? <Link href={`/teams/${card.teamId}/issues/${card.issueId}`}>
          {card.repoName} #{card.number} · {card.title} · {STATUS[card.status]}
        </Link> : <p>{card.title}</p>}
      </li>)}
    </ul>
  );
}
