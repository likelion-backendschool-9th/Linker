#!/usr/bin/env bash
# 사용법: 레포 루트에서 `bash scripts/create-labels.sh`
# 사전 준비: GitHub CLI 설치 후 `gh auth login`
# --force 로 이미 있는 라벨은 색상·설명만 덮어씀

set -e

# 범위
gh label create "frontend"       --color "61DAFB" --description "프론트엔드 변경" --force
gh label create "backend"        --color "6DB33F" --description "백엔드 변경" --force
gh label create "docs"           --color "0075CA" --description "문서 변경" --force

# 종류
gh label create "feat"           --color "A2EEEF" --description "새 기능" --force
gh label create "fix"            --color "D73A4A" --description "버그 수정" --force
gh label create "refactor"       --color "FBCA04" --description "리팩토링" --force
gh label create "chore"          --color "CFD3D7" --description "설정·빌드·기타" --force

# 상태
gh label create "in progress"    --color "FEF2C0" --description "작업 중" --force
gh label create "review needed"  --color "E99695" --description "리뷰 필요" --force

echo "라벨 생성 완료"
