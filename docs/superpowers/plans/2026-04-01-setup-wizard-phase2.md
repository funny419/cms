# Setup Wizard Phase 2 — DB 연결 UI + .env 동적 생성 구현 계획

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**작성일:** 2026-04-01
**작성자:** planner-2 (qa, dba-2 의견 취합)
**목표:** 브라우저 UI에서 DB 연결 정보를 입력하고 `.env` 파일을 동적으로 생성하는 5단계 Setup Wizard 구현
**전제:** Phase 1 구현 완료 (커밋 7024855, 83499f9)

---

## 1. Phase 1 vs Phase 2 차이점

| 항목 | Phase 1 (완료) | Phase 2 (이번 구현) |
|------|--------------|------------------|
| 전제 상태 | DB 이미 연결됨 | DB 연결 정보 미입력 상태 |
| Wizard 단계 | 4단계 (환영→계정→사이트→완료) | 5단계 (DB연결→.env생성→재시작→계정→완료) |
| `.env` 역할 | WIZARD_COMPLETED 기록만 | DB 연결 정보 + WIZARD_COMPLETED 동적 생성 |
| Flask 기동 조건 | DB 연결 필수 | DB 없이도 Wizard 엔드포인트 응답 가능 |

---

## 2. 아키텍처 설계

### 2-1. 핵심 난제: Flask DB 없이 부분 기동

현재 `create_app()`은 SQLAlchemy를 즉시 초기화한다. DB 연결 실패 시 첫 쿼리에서 에러가 발생하지만, Flask 자체는 기동된다. 따라서 **Wizard 전용 엔드포인트가 DB를 건드리지 않으면** 응답 가능하다.

```
[Phase 2 기동 흐름]
docker compose up -d
  └─ DB 컨테이너 없어도 Flask 기동 (SQLAlchemy lazy connection)
      └─ GET /api/wizard/status → DB 연결 시도 → 실패 → { db_connected: false, step: 1 }
      └─ POST /api/wizard/db-test → 임시 엔진으로 연결 테스트
      └─ POST /api/wizard/env → .env 파일 작성
      └─ (사용자: docker compose restart backend)
      └─ GET /api/wizard/status → DB 연결 성공 → { db_connected: true, step: 3 }
      └─ POST /api/wizard/migrate → flask db upgrade 실행
      └─ POST /api/wizard/setup → 관리자 계정 생성 (Phase 1 재사용)
```

### 2-2. docker-compose.yml 변경 필요

현재 `depends_on: db: condition: service_healthy` 설정이 있어, DB가 healthy 상태가 아니면 backend가 아예 시작되지 않는다.

```yaml
# 현재 (변경 필요)
backend:
  depends_on:
    db:
      condition: service_healthy

# Phase 2 변경안
backend:
  depends_on:
    db:
      condition: service_started   # healthy 대신 started로 완화
      required: false              # DB 없어도 backend 기동 허용
```

> **⚠️ 트레이드오프:** `service_healthy` → `service_started` 변경 시, DB가 준비되기 전 Flask가 쿼리를 시도할 수 있다. `create_app()` 내 마이그레이션 로직에서 DB 미연결 시 graceful 처리가 필요하다.

### 2-3. Wizard 5단계 흐름

```
Step 1: DB 연결 정보 입력
  └─ host, port, user, password, dbname 입력
  └─ "연결 테스트" 버튼 → POST /api/wizard/db-test
  └─ 성공 → Step 2 / 실패 → 오류 분류 표시

Step 2: .env 파일 생성
  └─ POST /api/wizard/env (검증된 DB 정보 전달)
  └─ .env 파일 작성 (chmod 0o600)
  └─ "백엔드를 재시작해 주세요: docker compose restart backend"
  └─ "재시작 완료 후 이 페이지를 새로고침하세요" 안내

Step 3: DB 마이그레이션
  └─ (재시작 + 새로고침 후 자동 진입)
  └─ GET /api/wizard/status → step: 3 확인
  └─ POST /api/wizard/migrate → subprocess flask db upgrade
  └─ 성공 → Step 4

Step 4: 관리자 계정 + 사이트 설정
  └─ Phase 1의 POST /api/wizard/setup 재사용

Step 5: 완료
  └─ WIZARD_COMPLETED=true .env 추가
  └─ /login 이동
```

### 2-4. API 설계

```
GET  /api/wizard/status
  응답: { completed: bool, db_connected: bool, has_admin: bool, step: int }
  step 결정 로직:
    - DB 미연결 → step: 1
    - DB 연결 + 마이그레이션 미완료 → step: 3
    - DB 연결 + 마이그레이션 완료 + admin 없음 → step: 4
    - admin 있음 또는 WIZARD_COMPLETED → step: 5 (completed: true)

POST /api/wizard/db-test
  요청: { host, port, user, password, dbname }
  응답: { ok: bool, error: "auth_failed"|"host_unreachable"|"db_not_found"|"invalid_url"|null }
  처리: create_engine() 임시 연결 테스트 → 즉시 dispose()
  권한: 공개 (DB 미연결 상태에서 호출)
  보안: 응답에 비밀번호 절대 미포함, 로그에 render_as_string(hide_password=True)

POST /api/wizard/env
  요청: { host, port, user, password, dbname, secret_key?, jwt_secret_key? }
  응답: { success: bool }
  처리: .env 파일에 DATABASE_URL 등 필수 변수 작성 (chmod 0o600)
  권한: 공개

POST /api/wizard/migrate
  요청: {}
  응답: { success: bool, error: str }
  처리: subprocess.run(["flask", "db", "upgrade"])
    - returncode 0 → 성공
    - "already exists" stderr → flask db stamp head 후 재시도
    - "Multiple head" → 에러 반환 (수동 개입 필요 안내)
  권한: 공개

POST /api/wizard/setup  ← Phase 1 그대로 재사용
  (관리자 계정 생성 + options 저장 + WIZARD_COMPLETED .env 기록)
```

### 2-5. Wizard 단계 상태 추적

현재 Phase 1의 `GET /api/wizard/status`를 확장한다:

```python
# 단계 결정 로직
step = 1  # 기본: DB 연결 정보 입력 필요
if db_connected:
    step = 3  # DB 연결됨 → 마이그레이션
    if migration_ok:
        step = 4  # 마이그레이션 완료 → 관리자 계정
        if has_admin:
            step = 5  # 완료

# .env 생성 여부: DB_ENV_WRITTEN 환경변수 또는 .env 파일 내 DATABASE_URL 존재 여부
```

### 2-6. 보안 설계

| 위협 | 대응 |
|------|------|
| DB 비밀번호 응답 노출 | `db-test` 응답에 비밀번호 절대 미포함 |
| .env 파일 권한 | `os.chmod(env_path, 0o600)` |
| 스택트레이스 노출 | API 에러 응답에 연결 문자열/인증 정보 미포함 |
| 재시작 전 .env 재작성 | `DB_ENV_WRITTEN` 플래그로 중복 작성 방지 |
| Docker 소켓 마운트 | 사용 금지 — 수동 재시작 안내로 대체 |

---

## 3. 파일 변경 맵

### 3-1. 신규 생성

| 파일 | 역할 |
|------|------|
| `backend/api/wizard_phase2.py` | Phase 2 전용 엔드포인트 (db-test, env, migrate) |
| `backend/tests/test_wizard_phase2.py` | Phase 2 API 테스트 |

### 3-2. 수정

| 파일 | 변경 내용 |
|------|---------|
| `backend/api/wizard.py` | `GET /api/wizard/status`에 `step` 필드 + 마이그레이션 상태 확인 로직 추가 |
| `backend/app.py` | `wizard_phase2_bp` Blueprint 등록 |
| `backend/app.py` | DB 미연결 시 `create_app()` fallback 처리 강화 |
| `docker-compose.yml` | `depends_on.db.condition: service_started`, `required: false` |
| `frontend/src/pages/SetupWizard.jsx` | 5단계로 확장 (Step 1~2 DB 연결 UI 추가) |
| `frontend/src/api/wizard.js` | `testDbConnection()`, `saveEnvFile()`, `runMigration()` 추가 |

---

## 4. 단계별 구현 계획 (Chunk별 Task 분해)

### Chunk 1: docker-compose.yml + app.py fallback 처리

- [ ] `docker-compose.yml` — `depends_on.db.condition` → `service_started`, `required: false`
- [ ] `backend/app.py` — DB 미연결 시 마이그레이션 스킵 + 경고만 출력 (현재 이미 try/except 있음, 보강)
- [ ] 로컬에서 DB 없이 Flask 기동 가능한지 검증

### Chunk 2: Phase 2 BE API 구현

- [ ] `backend/api/wizard_phase2.py` 생성
  - `POST /api/wizard/db-test` — 4종 오류 분류
  - `POST /api/wizard/env` — .env 파일 작성
  - `POST /api/wizard/migrate` — flask db upgrade subprocess
- [ ] `backend/api/wizard.py` — `GET /api/wizard/status`에 `step` 필드 추가
- [ ] `backend/app.py` — `wizard_phase2_bp` 등록
- [ ] `backend/tests/test_wizard_phase2.py` 작성

### Chunk 3: FE 마법사 UI 확장

- [ ] `frontend/src/api/wizard.js` — `testDbConnection()`, `saveEnvFile()`, `runMigration()` 추가
- [ ] `frontend/src/pages/SetupWizard.jsx` — 5단계로 확장
  - Step 1: DB 연결 정보 입력 폼 (host/port/user/password/dbname) + 연결 테스트 버튼
  - Step 2: .env 생성 완료 + 재시작 안내 ("터미널에서 `docker compose restart backend` 실행 후 새로고침")
  - Step 3: 마이그레이션 실행 + 진행 표시
  - Step 4: 관리자 계정 + 사이트 설정 (Phase 1 재사용)
  - Step 5: 완료

### Chunk 4: 회귀 테스트 + 문서

- [ ] 기존 pytest 전체 통과 확인 (Phase 1 테스트 포함)
- [ ] `api.md` — Phase 2 엔드포인트 추가
- [ ] `roadmap.md` — Setup Wizard Phase 2 완료 반영

---

## 5. 예상 이슈 및 리스크

### 5-1. docker-compose.yml `service_healthy` 제거 (HIGH)

`depends_on.db.condition: service_started`로 변경 시, DB 준비 전 Flask가 기동되면 첫 쿼리에서 `OperationalError`가 발생한다.

**대응:**
- `create_app()`의 마이그레이션 로직이 이미 try/except로 처리되어 있음
- 실제 요청 시 DB 미연결 에러는 `GET /api/wizard/status`의 `_db_connected()` try/except로 캐치
- 프로덕션 `docker-compose.prod.yml`은 변경 안 함 (DB 연결 전제)

### 5-2. Flask 재시작 후 세션 유지 (MEDIUM)

`.env` 작성 후 사용자가 재시작하면 FE는 새로고침해야 한다. 이 단계에서 step 상태를 localStorage에 임시 저장하지 않으면 Step 1부터 다시 시작해야 하는 UX 문제가 있다.

**대응:** FE에서 `localStorage.setItem('wizard_step', '3')`으로 재시작 후 step 복원. `GET /api/wizard/status`의 `step` 필드를 기준으로 서버 상태와 대조하여 정합성 확인.

### 5-3. subprocess flask db upgrade 보안 (MEDIUM)

`subprocess.run(["flask", "db", "upgrade"])`는 Flask 프로세스 내에서 실행되므로, 인젝션 위험은 없다 (사용자 입력을 인자로 받지 않음). 단, returncode 외 stderr 내용을 응답에 포함 시 민감 정보 노출 위험이 있다.

**대응:** stderr는 서버 로그에만 기록하고, API 응답에는 `error: "migration_failed"` 코드만 반환.

### 5-4. .env 파일 중복 작성 (LOW)

사용자가 Step 2를 여러 번 실행하면 .env에 DATABASE_URL이 중복 기록될 수 있다.

**대응:** `backend/api/wizard_phase2.py`에서 기존 .env를 파싱 후 키별 업데이트. `python-dotenv`의 `set_key()` 함수 활용.

### 5-5. 프로덕션 배포 영향 (LOW)

`docker-compose.yml`(개발용) 변경이 `docker-compose.prod.yml`(프로덕션)에는 영향 없음. 프로덕션은 GitHub Actions가 별도 파일을 사용하므로 안전.

---

## 6. QA TC 시나리오 (qa 의견)

| 우선순위 | 시나리오 |
|---------|---------|
| High | DB 연결 테스트 성공 → 4종 오류 분류 각각 검증 |
| High | .env 파일 생성 후 chmod 0o600 확인 |
| High | 마이그레이션 성공/실패 분기 |
| High | Phase 1 기능 회귀 없음 확인 (기존 22개 테스트) |
| Medium | 재시작 전 step 상태 localStorage 복원 |
| Medium | DB 비밀번호가 API 응답에 포함되지 않는지 확인 |
| Medium | 마이그레이션 "already exists" → stamp head 자동 처리 |

---

## 7. 공수 추정

| 작업 | 공수 |
|------|------|
| Chunk 1 (docker-compose + fallback) | 0.5일 |
| Chunk 2 (Phase 2 BE API) | 1.5일 |
| Chunk 3 (FE UI 확장) | 1일 |
| Chunk 4 (테스트 + 문서) | 0.5일 |
| **합계** | **약 3.5일** |

---

## 8. 구현 우선순위

| Phase | 내용 | 우선순위 |
|-------|------|---------|
| Phase 1 (완료) | 관리자 계정 생성 + 사이트 설정 | ✅ 완료 |
| Phase 2 (이번) | DB 연결 UI + .env 동적 생성 + 마이그레이션 | **즉시 구현** |
