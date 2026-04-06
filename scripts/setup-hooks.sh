#!/usr/bin/env bash
# pre-commit 훅 설치 스크립트
# 사용법: bash scripts/setup-hooks.sh

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOK_TARGET="$REPO_ROOT/.git/hooks/pre-commit"
HOOK_SOURCE="$REPO_ROOT/scripts/pre-commit.sh"

chmod +x "$HOOK_SOURCE"
ln -sf "$HOOK_SOURCE" "$HOOK_TARGET"

echo "✅ pre-commit 훅 설치 완료: $HOOK_TARGET → $HOOK_SOURCE"
echo "   (수동 실행: bash scripts/pre-commit.sh)"
