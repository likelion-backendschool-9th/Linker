#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]

roots = [
    ROOT / "frontend/apps/web",
    ROOT / "docs",
    ROOT / "frontend/AGENTS.md",
    ROOT / "README.md",
]
skip = {"node_modules", ".next", "scripts"}
suffixes = {".ts", ".tsx", ".js", ".mjs", ".md", ".css", ".json"}

patterns = [
    (re.compile(r"/users/"), "/user/"),
    (re.compile(r"%2Fusers%2F"), "%2Fuser%2F"),
    (re.compile(r"\\/users\\/"), r"\/user\/"),
    (re.compile(r"\(public\)/users/"), "(public)/user/"),
    (re.compile(r"`/users/\[login\]`"), "`/user/[login]`"),
    (re.compile(r"/users/\[login\]"), "/user/[login]"),
]


def main() -> None:
    changed: list[str] = []
    for base in roots:
        paths = [base] if base.is_file() else [p for p in base.rglob("*") if p.is_file()]
        for path in paths:
            if any(s in path.parts for s in skip):
                continue
            if path.suffix.lower() not in suffixes and path.name != "README.md":
                continue
            text = path.read_text(encoding="utf-8")
            protected = text.replace("/admin/users", "/admin/__ADMIN_USERS__")
            protected = protected.replace("admin/users", "admin/__ADMIN_USERS__")
            new = protected
            for rx, repl in patterns:
                new = rx.sub(repl, new)
            new = new.replace("/admin/__ADMIN_USERS__", "/admin/users")
            new = new.replace("admin/__ADMIN_USERS__", "admin/users")
            if new != text:
                path.write_text(new, encoding="utf-8", newline="\n")
                changed.append(str(path.relative_to(ROOT)).replace("\\", "/"))
    print(f"changed {len(changed)} files")
    for p in changed:
        print(" ", p)


if __name__ == "__main__":
    main()
