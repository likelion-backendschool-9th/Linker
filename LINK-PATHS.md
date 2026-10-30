# Link paths after moving docs into the repo

In the repo, `docs/` holds 01–09 and `frontend/` holds `10-frontend-blueprint.md`. The docs were written side by side, so these relative links break:

| File (repo path) | Old link | New link | Where |
| --- | --- | --- | --- |
| `docs/07-page-todo.md` | `./10-frontend-blueprint.md` | `../frontend/10-frontend-blueprint.md` | 2 links (00 "Frontend" note, ch. 11 days 1–2 row) |
| `docs/09-wbs.md` | `./10-frontend-blueprint.md` | `../frontend/10-frontend-blueprint.md` | 3 links (2-2 end of D2, ch. 3 A JWT task, ch. 3 B sitemap task) |
| `frontend/10-frontend-blueprint.md` | `./04-policy.md`, `./07-page-todo.md`, `./09-wbs.md` | `../docs/04-policy.md`, `../docs/07-page-todo.md`, `../docs/09-wbs.md` | 6 links (header lines 4 and 6, §1-1) |

One-shot fix from the repo root:

```bash
sed -i 's#](\./10-frontend-blueprint\.md#](../frontend/10-frontend-blueprint.md#g' docs/07-page-todo.md docs/09-wbs.md
sed -i -E 's#]\(\./(0[0-9][^)]*)#](../docs/\1#g' frontend/10-frontend-blueprint.md
```

Plain-text mentions ("frontend blueprint §x, in the frontend repo") in 01–06 and 08 need no change.
