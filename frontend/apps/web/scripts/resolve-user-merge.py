#!/usr/bin/env python3
"""Resolve mid-merge conflicts: keep app unit tree, adopt /user URL, drop src leftovers."""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]  # Linker root (apps/web/scripts -> 3 up? web->apps->frontend->Linker = 3)
# __file__ = Linker/frontend/apps/web/scripts/resolve-user-merge.py
# parents[0]=scripts, [1]=web, [2]=apps, [3]=frontend, [4]=Linker
REPO = Path(__file__).resolve().parents[4]


def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, cwd=REPO, text=True, capture_output=True, check=check)


def unmerged() -> list[str]:
    out = run(["git", "diff", "--name-only", "--diff-filter=U"], check=False).stdout
    return [line.strip() for line in out.splitlines() if line.strip()]


def main() -> None:
    files = unmerged()
    print(f"unmerged: {len(files)}")
    src_files = [f for f in files if "/src/" in f]
    users_files = [f for f in files if "/(public)/users/" in f]
    other = [f for f in files if f not in src_files and f not in users_files]
    print(f"src={len(src_files)} users={len(users_files)} other={len(other)}")

    for f in src_files:
        run(["git", "rm", "-f", "--ignore-unmatch", f], check=False)

    for f in users_files + other:
        run(["git", "checkout", "--ours", "--", f], check=False)
        run(["git", "add", "--", f], check=False)

    # Rename app/(public)/users -> user (directory)
    users_dir = REPO / "frontend/apps/web/app/(public)/users"
    user_dir = REPO / "frontend/apps/web/app/(public)/user"
    if users_dir.exists():
        if user_dir.exists():
            # Unexpected: remove empty/partial user dir from theirs if present
            print(f"note: {user_dir} already exists")
        else:
            users_dir.rename(user_dir)
            print("renamed users/ -> user/")
            # Re-stage rename for git
            run(["git", "add", "-A", "frontend/apps/web/app/(public)/user"], check=False)
            # Remove old users paths from index if still tracked
            run(["git", "rm", "-r", "--cached", "--ignore-unmatch", "frontend/apps/web/app/(public)/users"], check=False)

    # Drop any leftover src tree under apps/web
    src_root = REPO / "frontend/apps/web/src"
    if src_root.exists():
        run(["git", "rm", "-r", "-f", "--ignore-unmatch", "frontend/apps/web/src"], check=False)
        # If still on disk after git rm (untracked), remove
        if src_root.exists():
            import shutil

            shutil.rmtree(src_root)
            print("removed leftover frontend/apps/web/src from disk")

    # Replace profile URL /users/ -> /user/ carefully (not admin/users)
    web = REPO / "frontend/apps/web"
    doc = REPO / "docs"
    patterns = [
        (re.compile(r"/users/"), "/user/"),
        (re.compile(r"%2Fusers%2F"), "%2Fuser%2F"),
        (re.compile(r"/users/\$\{"), "/user/${"),
        (re.compile(r"`/users/\$\{"), "`/user/${"),
        (re.compile(r"'/users/"), "'/user/"),
        (re.compile(r'"/users/'), '"/user/'),
        (re.compile(r"\\/users\\/"), r"\/user\/"),
        (re.compile(r"\(public\)/users/"), "(public)/user/"),
        (re.compile(r"profile URL `/users/\[login\]`"), "profile URL `/user/[login]`"),
        (re.compile(r"`/users/\[login\]`"), "`/user/[login]`"),
        (re.compile(r"/users/\[login\]"), "/user/[login]"),
    ]

    skip_parts = {"node_modules", ".next", "scripts"}
    changed = 0
    for base in (web, doc, REPO / "frontend/AGENTS.md", REPO / "README.md"):
        paths: list[Path] = []
        if base.is_file():
            paths = [base]
        elif base.is_dir():
            for p in base.rglob("*"):
                if not p.is_file():
                    continue
                if any(part in skip_parts for part in p.parts):
                    continue
                if p.suffix.lower() not in {
                    ".ts",
                    ".tsx",
                    ".js",
                    ".mjs",
                    ".md",
                    ".css",
                    ".json",
                }:
                    continue
                paths.append(p)
        for path in paths:
            text = path.read_text(encoding="utf-8")
            # Protect admin users paths
            protected = text.replace("/admin/users", "/admin/__ADMIN_USERS__")
            protected = protected.replace("admin/users", "admin/__ADMIN_USERS__")
            new = protected
            for rx, repl in patterns:
                new = rx.sub(repl, new)
            new = new.replace("/admin/__ADMIN_USERS__", "/admin/users")
            new = new.replace("admin/__ADMIN_USERS__", "admin/users")
            # Also fix sitemap label if present as /sitemap/users — keep as-is unless docs say otherwise
            if new != text:
                path.write_text(new, encoding="utf-8", newline="\n")
                changed += 1
    print(f"url rewrite files changed: {changed}")

    # Stage everything under web app + docs touched
    run(["git", "add", "-A", "frontend/apps/web", "docs", "frontend/AGENTS.md", "README.md"], check=False)

    left = unmerged()
    print(f"remaining unmerged: {len(left)}")
    for f in left[:30]:
        print(" ", f)


if __name__ == "__main__":
    main()
