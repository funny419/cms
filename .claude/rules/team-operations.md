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

### 팀원 스폰 시 model 명시 규칙

- **반드시 `model: "sonnet"` 명시할 것** — 생략하면 오류 발생
- 검증된 model 값: `"sonnet"` (claude-sonnet-4-6), `"haiku"` (claude-haiku-4-5-20251001)
- `"opus"` 및 model 생략 모두 현재 API에서 유효하지 않음

### 응답 언어

모든 팀원은 **한국어**로 응답한다.
