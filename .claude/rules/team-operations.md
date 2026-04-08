## 팀 에이전트 운영 규칙 (필독)

새로 스폰되는 팀원은 이 파일을 반드시 숙지하고 작업을 시작해야 합니다.

### 작업 지시 체계

- 작업 지시는 반드시 **team-lead → 팀원** 순서로만 내려온다
- team-lead의 명시적 지시 없이는 어떤 작업도 시작하지 않는다
- planner 경유 작업도 반드시 team-lead 승인이 전제되어야 한다

### 대기 중 행동 기준

- 지시받은 작업이 없으면 **idle 상태로 대기**
- 타 팀원으로부터 먼저 업무 논의를 시작하지 않는다
- 타 팀원의 업무 논의 요청에도 team-lead 지시 없이 응하지 않는다

### 허용되는 팀원 간 직접 소통

- team-lead가 명시적으로 승인한 작업의 연장선 (예: writer가 문서 확인 요청)
- team-lead가 "A와 B가 협의하라"고 명시한 경우

### 완료 보고 형식 (코드 변경 시 필수)

작업 완료 보고 시 아래 항목을 반드시 SendMessage로 team-lead에게 보고할 것:

- **DB 변경**: 테이블명 + 컬럼명 + 마이그레이션 파일명
- **API 변경**: 엔드포인트 + 요청/응답 필드
- **컴포넌트 변경**: 파일 경로
- **커밋 해시**
- **코드 리뷰 결과** (`code-review.md` 체크리스트 실행 결과)

예시:
```
[완료 보고]
- DB: posts.thumbnail_url VARCHAR(500) NULL 추가 (마이그레이션: abc1234_add_thumbnail.py)
- API: GET /api/posts 응답에 thumbnail_url 필드 추가
- 컴포넌트: frontend/src/pages/BlogLayoutPhoto.jsx 신규
- 커밋: a1b2c3d
- 코드 리뷰: 통과
```

### 파일 소유권

- `conftest.py`, `scripts/pre-commit.sh`, `pyproject.toml` 등 공유 테스트 인프라 파일은 **backend 담당 전용**
- 다른 팀원이 해당 파일 수정 시 team-lead 명시적 승인 필수
- `.claude/rules/*.md` 파일 수정은 **writer 전담** — 다른 팀원이 직접 수정 시 즉시 writer에게 커밋 위임 요청

### user 직접 지시 처리 기준

- user(최상위 지시권자)가 팀원에게 직접 작업을 지시할 경우: planner가 해당 메시지를 수신하면 team-lead에게 전달하고 승인을 받은 후 진행
- 작업 중단 지시 중 user 직접 지시가 수신된 경우에도 동일하게 team-lead 확인 후 진행

### staging area 관리 규칙

- 커밋 전 `git diff --cached --name-only`로 staging area에 자신의 파일만 있는지 반드시 확인
- `git add .` 또는 `git add -A` 사용 금지 — 반드시 `git add <파일명>` 방식으로 명시적 staging
- staging area에 타 팀원 파일이 포함된 경우 `git restore --staged <파일명>`으로 unstage 후 커밋

### 작업 완료 추적

- 커밋 완료 시 SendMessage 보고와 함께 `TaskUpdate(status: completed)` 병행
- 컨텍스트 압축/세션 재개 후에는 team-lead로부터 명시적 재개 승인을 받기 전 파일 수정/커밋 없이 대기

### 인프라 관련 작업 지시 기준

- 새 Python 패키지 도입 시 backend는 apt/시스템 패키지 의존성 여부를 함께 명시하고 infra에 사전 공유
- Nginx/Docker 설정 변경 지시 시 현재 파일 내용 또는 관련 git diff를 함께 첨부
- 아키텍처 방식 결정(레이어 선택 등)은 확정 후 infra에 지시 — 결정 전 검토 요청은 "FYI" 명시

### 팀원 스폰 시 model 명시 규칙

- **반드시 `model: "sonnet"` 명시할 것** — 생략하면 오류 발생
- 검증된 model 값: `"sonnet"` (claude-sonnet-4-6), `"haiku"` (claude-haiku-4-5-20251001)
- `"opus"` 및 model 생략 모두 현재 API에서 유효하지 않음

### 응답 언어

모든 팀원은 **한국어**로 응답한다.
