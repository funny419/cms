#!/usr/bin/env bash
# CMS 프로젝트 pre-commit 검증 스크립트
# 설치: scripts/setup-hooks.sh 실행
set -eo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILED=0

# 스테이징된 파일 목록
STAGED_PY=$(git diff --cached --name-only --diff-filter=ACMR | grep '\.py$' || true)
STAGED_JS=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(js|jsx)$' || true)

# ─── Python 검사 ────────────────────────────────────────────────

if [ -n "$STAGED_PY" ]; then
  # 백엔드 컨테이너 실행 여부 확인
  if ! docker compose ps --quiet backend 2>/dev/null | grep -q .; then
    echo -e "${YELLOW}⚠  백엔드 컨테이너 미실행. Python 검사 건너뜀.${NC}"
  else
    # 1. ruff lint + auto-fix (Docker 내부 경로는 /app 루트 → '.')
    echo "▶ ruff lint + auto-fix..."
    if docker compose exec -T backend ruff check . --fix --quiet 2>&1; then
      docker compose exec -T backend ruff format . --quiet 2>&1 || true
      # 자동 수정된 파일 재스테이징 (원래 스테이징된 .py 파일만)
      echo "$STAGED_PY" | tr '\n' '\0' | xargs -0 git add -- 2>/dev/null || true
      echo -e "${GREEN}  ✓ ruff${NC}"
    else
      echo -e "${RED}  ✗ ruff 실패 — 위 오류를 확인하세요.${NC}"
      FAILED=1
    fi

    # 2. mypy (ruff 통과 시만)
    if [ "$FAILED" -eq 0 ]; then
      echo "▶ mypy type check..."
      if docker compose exec -T backend mypy . --no-error-summary 2>&1; then
        echo -e "${GREEN}  ✓ mypy${NC}"
      else
        echo -e "${RED}  ✗ mypy 실패 — 타입 오류를 수정하세요.${NC}"
        FAILED=1
      fi
    fi

    # 3. pytest (mypy 통과 시만) — exit 5 = 테스트 없음 (pass로 처리)
    if [ "$FAILED" -eq 0 ]; then
      echo "▶ pytest..."
      docker compose exec -T backend pytest -q --tb=short -x 2>&1 || PYTEST_EXIT=$?
      PYTEST_EXIT=${PYTEST_EXIT:-0}
      if [ "$PYTEST_EXIT" -eq 0 ] || [ "$PYTEST_EXIT" -eq 5 ]; then
        echo -e "${GREEN}  ✓ pytest${NC}"
      else
        echo -e "${RED}  ✗ pytest 실패 — 테스트를 수정하세요.${NC}"
        FAILED=1
      fi
    fi
  fi
fi

# ─── JavaScript 검사 ─────────────────────────────────────────────

if [ -n "$STAGED_JS" ]; then
  if ! docker compose ps --quiet frontend 2>/dev/null | grep -q .; then
    echo -e "${YELLOW}⚠  프론트엔드 컨테이너 미실행. JS 검사 건너뜀.${NC}"
  else
    echo "▶ eslint..."
    if docker compose exec -T frontend npx eslint src/ 2>&1; then
      echo -e "${GREEN}  ✓ eslint${NC}"
    else
      echo -e "${RED}  ✗ eslint 실패 — 위 오류를 수정하세요.${NC}"
      FAILED=1
    fi
  fi
fi

# ─── 결과 ────────────────────────────────────────────────────────

if [ "$FAILED" -ne 0 ]; then
  echo ""
  echo -e "${RED}❌ pre-commit 검증 실패. 위 오류를 모두 수정 후 다시 커밋하세요.${NC}"
  exit 1
fi

if [ -z "$STAGED_PY" ] && [ -z "$STAGED_JS" ]; then
  exit 0
fi

echo ""
echo -e "${GREEN}✅ 모든 검사 통과!${NC}"
exit 0
