#!/usr/bin/env python3
"""Checks PR rules from AGENTS.md "Git workflow": title format, Korean description, branch name, agent attribution.

Input comes from environment variables so PR text is never interpolated into a shell script:
PR_TITLE, PR_BODY, HEAD_REF, BASE_REF, COMMITS_FILE (commit messages separated by a NUL byte).
"""
import os
import re
import sys

TYPES = ("feat", "fix", "chore", "docs")
TITLE_RE = re.compile(r"^(?P<type>%s): (?P<desc>\S.*)$" % "|".join(TYPES))
BRANCH_RE = re.compile(r"^(?P<type>%s)/[a-z0-9]+(?:-[a-z0-9]+)*$" % "|".join(TYPES))
HANGUL_RE = re.compile(r"[가-힣]")

AGENTS = r"(?:claude|anthropic|cursor|copilot|codex|gemini|chatgpt|openai|devin|aider)"
AGENT_MARKS = (
    re.compile(r"co-authored-by:[^\n]*%s" % AGENTS, re.I),
    re.compile(r"generated\s+(?:with|by)\s+\[?%s" % AGENTS, re.I),
    re.compile(r"made[- ]with:?\s*%s" % AGENTS, re.I),
    re.compile(r"noreply@anthropic\.com", re.I),
)


def check_title(title):
    match = TITLE_RE.match(title)
    if not match:
        return None, ["PR 제목은 '<type>: <설명>' 형식이어야 합니다 (type: %s)." % ", ".join(TYPES)]
    if not HANGUL_RE.search(match.group("desc")):
        return match.group("type"), ["PR 제목의 설명은 한국어로 작성해야 합니다."]
    return match.group("type"), []


def check_branch(head_ref, base_ref, title_type):
    if head_ref == "dev" and base_ref == "main":
        return []
    match = BRANCH_RE.match(head_ref)
    if not match:
        return ["브랜치 이름은 '<type>/<kebab-case>' 형식이어야 합니다 (type: %s): %s" % (", ".join(TYPES), head_ref)]
    if title_type and match.group("type") != title_type:
        return ["브랜치 type(%s)과 PR 제목 type(%s)이 같아야 합니다." % (match.group("type"), title_type)]
    return []


def find_agent_marks(label, text):
    errors = []
    for pattern in AGENT_MARKS:
        for found in pattern.finditer(text):
            errors.append("%s에 에이전트 표시가 있습니다: %s" % (label, found.group(0).strip()))
    return errors


def run(title, body, head_ref, base_ref, commits):
    title_type, errors = check_title(title)
    errors += check_branch(head_ref, base_ref, title_type)
    errors += find_agent_marks("PR 제목", title)
    errors += find_agent_marks("PR 본문", body)
    for index, message in enumerate(commits, start=1):
        errors += find_agent_marks("커밋 %d" % index, message)
    return errors


def read_commits(path):
    if not path or not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as handle:
        return [message for message in handle.read().split("\0") if message.strip()]


def main():
    errors = run(
        os.environ.get("PR_TITLE", ""),
        os.environ.get("PR_BODY", ""),
        os.environ.get("HEAD_REF", ""),
        os.environ.get("BASE_REF", ""),
        read_commits(os.environ.get("COMMITS_FILE", "")),
    )
    for error in errors:
        print("::error::%s" % error)
    if errors:
        return 1
    print("PR 규칙 검사를 통과했습니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
