import type { ChatPullRequest } from '@linker/api/openAPIDefinition.schemas';
import { listChatPullRequests } from '@linker/api/p17-chat-room/p17-chat-room';

/** B's `GithubController` list. `state` is lowercase `open` or `merged`. */
export type PullRequest = ChatPullRequest;

export function fetchPullRequests(roomId: number, state: 'open' | 'merged', signal?: AbortSignal) {
  return listChatPullRequests(roomId, { state }, { signal });
}
