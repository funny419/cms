#!/usr/bin/env bash
# PreToolUse Hook: Simplicity First 게이트
# 새 추상화 파일(hooks/, services/, context/, api/helpers) 생성 시 경고 메시지 출력

FILE_PATH=$(echo "$CLAUDE_TOOL_INPUT" | jq -r '.file_path // ""' 2>/dev/null || echo "")

[ -z "$FILE_PATH" ] && exit 0

# 신규 추상화 패턴 감지
echo "$FILE_PATH" | grep -qE '(hooks/use[A-Z]|services/[a-zA-Z]|context/[A-Z][a-zA-Z]+Context|api/helpers)\.(js|jsx|py)$' || exit 0

FILENAME=$(basename "$FILE_PATH")

printf '{
  "systemMessage": "Simplicity First 게이트: 신규 추상화 파일 감지 [%s]. 새 훅/서비스/Context/헬퍼 생성 전 grep으로 사용처를 확인했나요? 사용처 10개+: 추상화 정당, 3~9개: 권장, 1~2개: 인라인 유지 + team-lead 승인 필요. grep 결과 없이 진행하면 오버엔지니어링 위험이 있습니다."
}' "$FILENAME"
