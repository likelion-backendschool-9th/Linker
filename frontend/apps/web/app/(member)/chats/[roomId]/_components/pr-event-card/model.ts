import { messagePayload } from '@/features/share/chat-cards';
import { toKstIso } from '@/lib/format/time';
import type { RoomMessage } from '../../_lib/room-api';

export const PR_EVENTS = {
  OPENED: { label: 'PR이 생성 되었습니다', verb: '열렸어요' },
  REVIEW_REQUESTED: { label: 'PR이 리뷰를 기다리고 있습니다', verb: '리뷰가 요청됐어요' },
  MERGED: { label: 'PR이 병합 되었습니다', verb: '병합됐어요' },
  CLOSED: { label: 'PR이 닫혔습니다', verb: '닫혔어요' },
} as const;

/** Read the existing postPullRequestEvent payload and text, without adding a server contract. */
export function prEventDetails(message: RoomMessage) {
  const payload = messagePayload(message.payload);
  const event =
    typeof payload?.event === 'string' && Object.hasOwn(PR_EVENTS, payload.event)
      ? (payload.event as keyof typeof PR_EVENTS)
      : null;
  const repo = typeof payload?.repo === 'string' ? payload.repo : '';
  const slash = repo.indexOf('/');
  const organization = slash > 0 ? repo.slice(0, slash) : null;
  const repository = slash > 0 ? repo.slice(slash + 1) : repo;
  const number = typeof payload?.prNumber === 'number' ? payload.prNumber : null;
  const text = message.text ?? '';
  // ChatService stores: PR #N "<GitHub title>" · <event verb>.
  // Strip only that exact envelope, preserving quotes/numbers/verbs inside the actual title.
  const prefix = `PR #${number} "`;
  const suffix = event ? `" · ${PR_EVENTS[event].verb}` : '';
  const title =
    event && number !== null && text.startsWith(prefix) && text.endsWith(suffix)
      ? text.slice(prefix.length, -suffix.length)
      : text;
  return {
    event,
    label: event ? PR_EVENTS[event].label : 'GitHub PR 알림',
    number,
    title,
    organization,
    repository,
    repo,
    url: typeof payload?.url === 'string' ? payload.url : null,
  };
}

/** Adjacent visible PR events from one organization share its photo/name within the KST day. */
export function continuesPrGroup(
  previous: RoomMessage | undefined,
  current: RoomMessage | undefined,
) {
  const visible = (item: RoomMessage | undefined): item is RoomMessage =>
    !!item && item.type === 'PR_EVENT' && item.visibility !== 'HIDDEN' && !item.deletedAt;
  if (!visible(previous) || !visible(current) || previous.roomId !== current.roomId) return false;
  const organization = prEventDetails(current).organization;
  return (
    !!organization &&
    prEventDetails(previous).organization === organization &&
    toKstIso(previous.createdAt).slice(0, 10) === toKstIso(current.createdAt).slice(0, 10)
  );
}
