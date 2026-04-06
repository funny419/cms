#!/usr/bin/env bash
# PostToolUse(Bash) hook: git commit 실패 시 Claude에게 자가 수정 지시
# Claude Code가 자동으로 stdin으로 JSON을 전달함

INPUT=$(cat)

# git commit 명령인지 확인
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")
echo "$COMMAND" | grep -qE "git\s+commit" || exit 0

# 출력에서 pre-commit 실패 신호 탐지
OUTPUT=$(echo "$INPUT" | jq -r 'try (.tool_response.stdout // .tool_response // "") | tostring catch ""' 2>/dev/null || echo "")

if echo "$OUTPUT" | grep -qiE "(pre-commit|hook (failed|error)|ruff|mypy|pytest|FAILED|AssertionError|error:)"; then
  printf '{
    "systemMessage": "pre-commit 검증 실패. 위 오류를 분석하여 해당 파일을 직접 수정한 뒤, 수정된 파일을 git add하고 다시 git commit을 실행하세요. ruff auto-fix는 이미 적용됐을 수 있습니다."
  }'
fi

exit 0
