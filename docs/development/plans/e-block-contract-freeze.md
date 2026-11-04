# E ↔ D 차단 계약 freeze (D2)

> Owner: E · Consumer: D · Basis: Policy ch. 9 Blocking, ERD `user_blocks`, WBS ModerationController  
> Change rule: alter only with E+D mention; do not delete rows on unblock.

## Contract

| Action | Meaning |
| --- | --- |
| `POST /api/v1/user/blocks` | Open a period (`unblocked_at = null`). Idempotent while active. |
| `DELETE /api/v1/user/blocks/{userId}` | **Close** the active period (`unblocked_at = now`). Never delete the row. |
| Re-block after close | Insert a **new** period. Previous closed periods remain. |
| `GET /api/v1/user/me/blocks` | Active periods only (settings list). |

## D consumption (1:1 DM)

Call `BlockService.hidesDirectMessage(viewerId, senderId, messageCreatedAt)`.

- Hide when the viewer owns a period covering the message: `message.created_at ∈ [created_at, unblocked_at)`.
- Open period (`unblocked_at IS NULL`) covers every instant at or after `created_at`.
- Closed periods still hide messages that fell inside them (unblock does not reveal).
- **Team chat is exempt** — do not call this helper for team rooms.
- Current relationship checks (hide room, block apply/start) use `blockedEitherWay`, not history.

## Out of scope for this freeze

- Feed/profile/post visibility filters (pages borrow active blocks separately).
- Notification delivery suppression for blocked senders (D wires using the same period rule when implementing chat).
- Physical deletion of `user_blocks` history (forbidden by this freeze).
