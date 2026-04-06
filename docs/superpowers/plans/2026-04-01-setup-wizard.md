# Setup Wizard (DB 연결 마법사) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**작성일:** 2026-04-01
**작성자:** planner-2 (qa, dba-2 의견 취합)
**목표:** 처음 설치 시 브라우저에서 관리자 계정 생성 + 사이트 기본 설정을 안내하는 단계별 마법사 구현

---

## 1. 기능 범위 정의

### 현실적 제약 분석

현재 아키텍처에서 Docker 컨테이너가 DB 연결을 보장한다(`depends_on: db: condition: service_healthy`).
Flask `create_app()`이 시작 시 SQLAlchemy를 초기화하므로, **DB 연결 없이 Flask가 기동하는 시나리오는 현재 아키텍처와 충돌**한다.

따라서 Setup Wizard의 현실적 범위는 다음과 같이 분리한다:

### MVP (Phase 1) — 초기 설치 가이드 마법사

> **"DB는 docker-compose가 이미 연결, Wizard = 첫 관리자 계정 + 사이트 설정"**

| 단계 | 내용 |
|------|------|
| Step 1: 환영 | 설치 확인, DB 연결 상태 표시 (자동) |
| Step 2: 관리자 계정 | username, email, password 입력 → role=admin으로 계정 생성 |
| Step 3: 사이트 설정 | site_title, site_url, tagline 입력 |
| Step 4: 완료 | wizard_completed 플래그 저장, 관리자 대시보드로 이동 |

**트리거:** `options` 테이블에 `wizard_completed=true` 레코드가 없을 때 FE가 `/wizard`로 리다이렉트

### 완전 구현 (Phase 2) — DB 연결 정보 설정

> **"docker-compose.yml / .env 없이 순수 UI에서 DB 연결"**

| 내용 | 기술적 도전 |
|------|-----------|
| DB 호스트/포트/이름/유저/비밀번호 입력 | Flask가 DB 없이도 기동해야 함 |
| DB 연결 테스트 | SQLAlchemy `create_engine` 임시 연결 시도 |
| `.env` 파일 자동 생성 | 컨테이너 내 파일 쓰기 (볼륨 마운트 필요) |
| Flask 재시작 후 마이그레이션 실행 | `os.kill(os.getpid(), signal.SIGHUP)` |

**Phase 2는 아키텍처 전면 수정 필요 — 이번 구현에서는 MVP(Phase 1) 우선**

---

## 2. 아키텍처 설계

### 2-1. 마법사 활성화 조건 (Guard Logic)

```
FE 앱 시작
  └─ GET /api/wizard/status
      ├─ { completed: false } → /wizard 로 리다이렉트
      └─ { completed: true }  → 정상 라우팅
```

- `completed: false` 조건: `.env`의 `WIZARD_COMPLETED=true` 없음 **또는** admin 계정이 없음
- `completed: true` 이후 `/wizard` 직접 접근 → 403 또는 대시보드 리다이렉트
- **⚠️ 중요: options 테이블이 아닌 `.env` 파일에 저장** — options 테이블은 DB 연결 후에만 존재하므로 chicken-and-egg 문제 발생 (dba-2 의견)

### 2-2. BE API 설계

```
GET  /api/wizard/status
  응답: { completed: bool, db_connected: bool, has_admin: bool }
  권한: 공개 (DB 미연결 시에도 응답 가능해야 함)

POST /api/wizard/setup
  요청: {
    admin: { username, email, password },
    site:  { site_title, site_url, tagline }
  }
  응답: { success: bool, error: str }
  처리:
    1. WIZARD_COMPLETED 플래그 확인 → 이미 완료면 409 Conflict
    2. admin 계정 중복 확인
    3. User(role='admin') 생성
    4. options 테이블에 site_title, site_url, tagline 저장
    5. .env 파일에 WIZARD_COMPLETED=true 추가 (os.chmod 0o600 적용)
  권한: 공개 (마법사 완료 전에는 인증 없어야 함)
```

### 2-3. FE 마법사 UI 흐름

```
App.jsx 시작
  └─ useEffect: GET /api/wizard/status
      ├─ completed=false → <Navigate to="/wizard" />
      └─ completed=true  → 정상 라우팅

/wizard 페이지 (SetupWizard.jsx)
  └─ Step 1: 환영 + DB 연결 상태 표시
      └─ Step 2: 관리자 계정 입력
          └─ Step 3: 사이트 기본 설정
              └─ Step 4: 완료 → POST /api/wizard/setup → /login 이동
```

### 2-4. 보안 설계

| 위협 | 대응 |
|------|------|
| 마법사 완료 후 재접근 | `/api/wizard/setup` POST 시 `WIZARD_COMPLETED` 확인 → 409 Conflict |
| DB 비밀번호 노출 | Phase 2에서: 응답에 절대 미포함. 로그에는 `render_as_string(hide_password=True)` 사용 |
| 관리자 계정 중복 생성 | 마법사 완료 상태 + admin 계정 존재 여부 이중 체크 |
| 스택트레이스 노출 | API 에러 응답에 DB 연결 문자열/인증 정보 미포함 (dba-2 의견) |
| 미완료 상태 API 접근 | 설치 미완료 시 일반 API 차단 여부 검토 필요 (qa 의견) |
| HTTPS 미적용 환경 | 계획서 단계에서 경고 표시, 구현 범위 밖 |

---

## 3. 파일 변경 맵

### 신규 생성

| 파일 | 역할 |
|------|------|
| `backend/api/wizard.py` | Setup Wizard API Blueprint |
| `backend/tests/test_wizard.py` | Wizard API 테스트 |
| `frontend/src/pages/SetupWizard.jsx` | 마법사 UI (4단계) |

### 수정

| 파일 | 변경 내용 |
|------|---------|
| `backend/app.py` | `wizard_bp` 등록, DB 미연결 시 fallback 처리 |
| `frontend/src/App.jsx` | `/wizard` 라우트 추가, 앱 시작 시 wizard status 확인 |
| `frontend/src/api/` | `wizard.js` 신규 (getWizardStatus, submitWizardSetup) |
| `.claude/rules/api.md` | Wizard API 엔드포인트 추가 |
| `.claude/rules/roadmap.md` | Setup Wizard 완료 항목으로 이동 |

---

## 4. 단계별 구현 계획 (Chunk별 Task 분해)

### Chunk 1: BE API 구현

- [ ] `backend/api/wizard.py` 생성
  - `GET /api/wizard/status` — DB 연결 상태, wizard_completed, has_admin 반환
  - `POST /api/wizard/setup` — 관리자 계정 생성 + 사이트 설정 + wizard_completed 저장
- [ ] `backend/app.py` — `wizard_bp` Blueprint 등록
- [ ] `backend/tests/test_wizard.py` 작성
  - 정상 setup 플로우
  - 중복 setup 시도 (409)
  - 필수 필드 누락 (400)
  - password 최소 길이 검증

### Chunk 2: FE 마법사 UI 구현

- [ ] `frontend/src/api/wizard.js` 생성
  - `getWizardStatus()` — GET /api/wizard/status
  - `submitWizardSetup(data)` — POST /api/wizard/setup
- [ ] `frontend/src/pages/SetupWizard.jsx` 생성
  - Step 1: 환영 + DB 연결 상태 (초록/빨강 뱃지)
  - Step 2: 관리자 계정 폼 (username, email, password, confirm)
  - Step 3: 사이트 설정 폼 (site_title, site_url, tagline)
  - Step 4: 완료 화면 → `/login`으로 이동
  - 진행 상태 표시 (1/4, 2/4 ...)
- [ ] `frontend/src/App.jsx` 수정
  - `/wizard` 라우트 추가
  - `AppContent`에서 wizard status 체크 → 미완료 시 `/wizard` 리다이렉트

### Chunk 3: 보안 강화 + 회귀 테스트

- [ ] `/wizard` 직접 접근 방어: wizard 완료 상태면 `/` 리다이렉트
- [ ] admin 계정이 이미 존재하면 `/api/wizard/status` → `{ completed: true }` 반환
- [ ] 기존 pytest 전체 통과 확인
- [ ] FE vitest 전체 통과 확인

### Chunk 4: 문서 업데이트

- [ ] `api.md` Wizard API 엔드포인트 추가
- [ ] `roadmap.md` Setup Wizard 미구현 → 완료로 이동

---

## 5. 예상 이슈 및 리스크

### 5-1. DB 미연결 시 Flask 기동 문제 (HIGH)

현재 `create_app()`에서 SQLAlchemy가 초기화되면 DB 연결을 즉시 시도하지 않지만,
첫 쿼리 시점에 연결 실패한다. Phase 1 MVP에서는 DB가 항상 연결된 상태이므로 문제 없음.
Phase 2(완전 구현)에서는 lazy initialization 패턴 도입 필요.

**대응:** Phase 1에서는 DB 미연결 케이스 스킵. `/api/wizard/status`의 `db_connected` 필드는 try/except로 안전하게 처리.

### 5-2. 마법사 완료 후 재노출 방지 (MEDIUM)

`options` 테이블이 아직 생성되지 않은 경우(DB 연결 직후, 마이그레이션 전) `wizard_completed` 조회 자체가 실패할 수 있음.

**대응:** `GET /api/wizard/status` 에서 테이블 없으면 `{ completed: false, db_connected: false }` 반환.

### 5-3. 관리자 계정 없는 기존 설치 (MEDIUM)

기존 사용자가 이미 DB + 데이터를 가지고 있지만 `wizard_completed` 레코드가 없으면 마법사가 재노출될 수 있음.

**대응:** `wizard_completed` 플래그가 없더라도 admin 계정이 존재하면 `{ completed: true }` 반환. (= 기존 설치 보호)

### 5-4. 비밀번호 강도 검증 (LOW)

현재 register API에 비밀번호 길이 검증이 없음. 마법사에서는 최소 8자 이상 강제.

**대응:** `POST /api/wizard/setup` 에서 `len(password) < 8` 시 400 반환.

### 5-5. FE 무한 리다이렉트 (LOW)

App.jsx에서 wizard status 로딩 중 `/wizard`로 리다이렉트하면 `/wizard` 페이지도 같은 체크를 하는 경우 루프 발생 가능.

**대응:** `/wizard` 라우트에서는 status 체크 로직 제외 (이미 wizard 페이지에 있으므로).

---

## 6. QA 관점 (qa 팀원 의견)

### 핵심 TC 시나리오

| 우선순위 | 시나리오 |
|---------|---------|
| High | 정상 E2E 플로우: DB 연결 확인 → admin 계정 생성 → 사이트 설정 → 완료 |
| High | 중복 실행 방지: wizard 완료 후 `/api/wizard/setup` 재호출 → 409 |
| High | 마법사 완료 후 `/wizard` 직접 접근 → 대시보드 리다이렉트 |
| High | API 에러 응답에 DB 인증 정보 미노출 확인 |
| Medium | 필수 필드 누락 시 오류 메시지 표시 (username/email/password) |
| Medium | 비밀번호 불일치 / 8자 미만 → FE에서 즉시 피드백 |
| Medium | 기존 설치(admin 있음) → 마법사 미노출 |
| Medium | 중단 후 재시작: 브라우저 종료 → 재접속 시 Step 1부터 재시작 |
| Low | DB 연결 실패 오류 분류 표시 (auth_failed / host_unreachable 등, Phase 2) |

### 검증 기준

- 마법사 완료 후 `/login`으로 이동, 생성된 admin 계정으로 로그인 성공
- `.env` 파일에 `WIZARD_COMPLETED=true` + `options` 테이블에 site_title 저장 확인
- 마법사 URL 재접근 시 대시보드로 리다이렉트

---

## 7. DB/BE 관점 (dba-2 팀원 의견)

### DB 연결 테스트 로직 (오류 분류 4종)

```python
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError, ArgumentError

def test_db_connection(host, port, user, password, dbname):
    url = f"mysql+pymysql://{user}:{password}@{host}:{port}/{dbname}"
    engine = create_engine(url, pool_size=1, max_overflow=0,
                           connect_args={"connect_timeout": 5})
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"ok": True}
    except ArgumentError:
        return {"ok": False, "error": "invalid_url"}
    except OperationalError as e:
        msg = str(e)
        if "Access denied" in msg:
            return {"ok": False, "error": "auth_failed"}
        if "Unknown database" in msg:
            return {"ok": False, "error": "db_not_found"}
        if "Can't connect" in msg or "timed out" in msg:
            return {"ok": False, "error": "host_unreachable"}
        return {"ok": False, "error": "unknown"}
    finally:
        engine.dispose()  # 테스트용 엔진 즉시 해제
```

FE에서 `error` 코드에 따라 메시지 분기: `auth_failed` / `host_unreachable` / `db_not_found` / `invalid_url`

### wizard_completed 저장 방식 — `.env` 파일 권장

> **options 테이블 방식은 채택하지 않음**: DB 연결 전에는 options 테이블도 없어 chicken-and-egg 문제

```python
# .env 파일에 WIZARD_COMPLETED=true 추가
env_path = "/app/.env"
with open(env_path, "a") as f:
    f.write("\nWIZARD_COMPLETED=true\n")
os.chmod(env_path, 0o600)  # 타 프로세스 읽기 방지
```

앱 시작 시 체크:
```python
wizard_done = os.environ.get("WIZARD_COMPLETED") == "true"
```

### 마이그레이션 성공/실패 판단

```python
import subprocess
result = subprocess.run(["flask", "db", "upgrade"], capture_output=True, text=True)
if result.returncode == 0:
    pass  # 성공 — alembic_version 테이블로 2차 검증 가능
else:
    if "already exists" in result.stderr:
        # 기존 DB → flask db stamp head 후 재시도
    elif "Multiple head" in result.stderr:
        # 마이그레이션 분기 — 수동 개입 필요 안내
```

Phase 1(MVP)에서는 `app.py` 시작 시 이미 `flask db upgrade` 자동 실행 → 별도 처리 불필요.

### admin 계정 이중 보호

```python
has_admin = db.session.execute(
    select(User).where(User.role == "admin")
).scalar_one_or_none() is not None
```

### 비밀번호 안전 로그 처리

```python
# 안전한 로그 출력 (비밀번호 마스킹)
app.logger.info("DB connected: %s", engine.url.render_as_string(hide_password=True))
# → DB connected: mysql+pymysql://user:***@host:3306/dbname
```

---

## 8. 구현 우선순위 결정

| Phase | 내용 | 우선순위 |
|-------|------|---------|
| Phase 1 (MVP) | wizard status API + 관리자 계정 생성 + 사이트 설정 마법사 UI | **즉시 구현** |
| Phase 2 | DB 연결 정보 UI 설정 + .env 동적 생성 + Flask 재시작 | 아키텍처 검토 후 |

**예상 공수:**
- Phase 1: BE 1일 + FE 1일 + QA 0.5일 = **약 2.5일**
- Phase 2: 아키텍처 설계 1일 + BE 2일 + FE 1일 + QA 1일 = **약 5일**
