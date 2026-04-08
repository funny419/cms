# Setup Wizard TC (tc_wizard.md)

**대상:** Setup Wizard 초기 설치 플로우 (TC-W001~TC-W013)
**작성일:** 2026-04-01
**총 TC:** 13개
**환경:** http://localhost:5173 (FE), http://localhost:5000 (BE)

---

## 사전 준비

- Docker 컨테이너 실행: `docker compose up -d`
- **주의:** TC-W009/W011은 Wizard 미완료 상태(`WIZARD_COMPLETED` 환경변수 미설정, admin 계정 없음)에서 실행해야 함
  - 완료 상태 초기화: `docker compose exec backend bash -c "unset WIZARD_COMPLETED"`
  - 또는 admin 계정이 없는 별도 테스트 환경 사용

---

## 1. Wizard 완료 상태 리다이렉트

### TC-W001 Wizard 완료 상태에서 `/wizard` 접속 → `/login`으로 리다이렉트
- **전제조건:** `GET /api/wizard/status` 응답에 `completed: true`
- **테스트 단계:**
  1. 브라우저에서 `http://localhost:5173/wizard` 직접 진입
- **기대 결과:** `/login` 페이지로 자동 리다이렉트 (Wizard UI 노출 없음)
- **우선순위:** High

---

## 2. DB 연결 테스트

### TC-W002 DB 연결 테스트 — 정상 연결 성공 (200)
- **전제조건:** Docker DB 컨테이너 실행 중
- **테스트 단계:**
  ```bash
  curl -s -X POST http://localhost:5000/api/wizard/db-test \
    -H "Content-Type: application/json" \
    -d '{"host":"db","port":3306,"user":"funnycms","password":"dev_app_password","dbname":"cmsdb"}'
  ```
- **기대 결과:** HTTP 200, `{ "success": true, "data": { "error_code": null } }`
- **검증 결과:** ✅ PASS (2026-04-01)
- **우선순위:** High

### TC-W003 DB 연결 테스트 — 잘못된 비밀번호 → `auth_failed` (400)
- **전제조건:** Docker DB 컨테이너 실행 중
- **테스트 단계:**
  ```bash
  curl -s -X POST http://localhost:5000/api/wizard/db-test \
    -H "Content-Type: application/json" \
    -d '{"host":"db","port":3306,"user":"funnycms","password":"wrongpass","dbname":"cmsdb"}'
  ```
- **기대 결과:** HTTP 400, `{ "success": false, "data": { "error_code": "auth_failed" } }`
- **검증 결과:** ✅ PASS (2026-04-01)
- **우선순위:** High

### TC-W004 DB 연결 테스트 — 존재하지 않는 DB명 → `db_not_found` (400)
- **전제조건:** Docker DB 컨테이너 실행 중
- **테스트 단계:**
  ```bash
  curl -s -X POST http://localhost:5000/api/wizard/db-test \
    -H "Content-Type: application/json" \
    -d '{"host":"db","port":3306,"user":"funnycms","password":"dev_app_password","dbname":"nonexistent_xyz"}'
  ```
- **기대 결과:** HTTP 400, `{ "success": false, "data": { "error_code": "db_not_found" } }`
- **검증 결과:** ✅ PASS (2026-04-01)
- **우선순위:** High

### TC-W005 DB 연결 테스트 — 연결 불가 호스트 → `host_unreachable` (400)
- **전제조건:** 없음 (호스트가 실제로 없어야 함)
- **테스트 단계:**
  ```bash
  curl -s -X POST http://localhost:5000/api/wizard/db-test \
    -H "Content-Type: application/json" \
    -d '{"host":"unreachable_host_xyz","port":3306,"user":"funnycms","password":"dev_app_password","dbname":"cmsdb"}'
  ```
- **기대 결과:** HTTP 400, `{ "success": false, "data": { "error_code": "host_unreachable" } }`
- **비고:** 내부 connect_timeout=5초 대기 후 반환
- **검증 결과:** ✅ PASS (2026-04-01)
- **우선순위:** Medium

---

## 3. .env 저장

### TC-W006 .env 저장 후 재시작 안내 UI 표시
- **전제조건:** Wizard Step 2 진행 중 (DB 연결 성공 후)
- **테스트 단계:**
  1. FE Wizard Step 2에서 DB 정보 입력 → "저장" 클릭 (`POST /api/wizard/env`)
  2. 응답 성공 후 UI 확인
- **기대 결과:** "Docker 컨테이너를 재시작하세요" 또는 동등한 재시작 안내 메시지가 UI에 표시됨
- **우선순위:** Medium

### TC-W007 `DB_ENV_WRITTEN=true` 상태에서 env 재요청 → `already_written: true` 200 반환
- **전제조건:** `POST /api/wizard/env` 1회 이상 성공 (백엔드 메모리에 `DB_ENV_WRITTEN=true` 설정)
- **테스트 단계:**
  ```bash
  # 첫 요청 (201)
  curl -s -X POST http://localhost:5000/api/wizard/env \
    -H "Content-Type: application/json" \
    -d '{"host":"db","port":3306,"user":"funnycms","password":"dev_app_password","dbname":"cmsdb"}'

  # 재요청 (200 + already_written)
  curl -s -X POST http://localhost:5000/api/wizard/env \
    -H "Content-Type: application/json" \
    -d '{"host":"db","port":3306,"user":"funnycms","password":"dev_app_password","dbname":"cmsdb"}'
  ```
- **기대 결과:**
  - 첫 요청: HTTP 201, `{ "success": true, "data": {} }`
  - 재요청: HTTP 200, `{ "success": true, "data": { "already_written": true } }`
- **검증 결과:** ✅ PASS (2026-04-01) — 재요청 200 + `already_written: true` 확인
- **우선순위:** Medium

---

## 4. 마이그레이션

### TC-W008 마이그레이션 자동 실행 — 성공 후 200 반환
- **전제조건:** DB 연결 정상 (Step 2 완료 상태)
- **테스트 단계:**
  ```bash
  curl -s -X POST http://localhost:5000/api/wizard/migrate
  ```
- **기대 결과:** HTTP 200, `{ "success": true, "data": {}, "error": "" }`
- **비고:**
  - 이미 마이그레이션 완료 상태에서도 200 정상 반환 (재실행 안전)
  - "already exists" 발생 시 `flask db stamp head` 후 재시도 자동 처리
  - "Multiple head" 발생 시 409 반환
- **검증 결과:** ✅ PASS (2026-04-01) — 기완료 상태에서 200 확인
- **우선순위:** High

---

## 5. Setup 완료 (관리자 계정 생성)

### TC-W009 Setup 완료 — 관리자 계정 생성 성공 (201)
- **전제조건:** Wizard 미완료 상태 (`WIZARD_COMPLETED` 환경변수 미설정, admin 계정 없음), 마이그레이션 완료
- **테스트 단계:**
  ```bash
  curl -s -X POST http://localhost:5000/api/wizard/setup \
    -H "Content-Type: application/json" \
    -d '{"admin":{"username":"admin","email":"admin@example.com","password":"admin1234"},"site":{"site_title":"My CMS"}}'
  ```
- **기대 결과:**
  - HTTP 201, `{ "success": true }`
  - `POST /api/auth/login` (username=admin, password=admin1234) → 200 + access_token 발급
  - `.env`에 `WIZARD_COMPLETED=true` 기록됨
- **검증 결과:** 코드 레벨 검증 — `wizard.py:176-204` 확인 (현재 환경 완료 상태라 실 실행 불가)
- **우선순위:** High

### TC-W010 Setup 완료 후 재요청 → 409 (이미 완료)
- **전제조건:** Wizard 완료 상태 (`_wizard_completed()` true)
- **테스트 단계:**
  ```bash
  curl -s -X POST http://localhost:5000/api/wizard/setup \
    -H "Content-Type: application/json" \
    -d '{"admin":{"username":"admin2","email":"admin2@example.com","password":"admin1234"}}'
  ```
- **기대 결과:** HTTP 409, `{ "success": false, "error": "Setup already completed." }`
- **검증 결과:** ✅ PASS (2026-04-01) — 409 + "Setup already completed." 확인
- **우선순위:** Medium

### TC-W011 비밀번호 8자 미만으로 Setup 요청 → 400
- **전제조건:** Wizard 미완료 상태 (TC-W009와 동일 전제조건)
- **테스트 단계:**
  ```bash
  curl -s -X POST http://localhost:5000/api/wizard/setup \
    -H "Content-Type: application/json" \
    -d '{"admin":{"username":"admin","email":"admin@example.com","password":"short"}}'
  ```
- **기대 결과:** HTTP 400, `{ "success": false, "error": "Password must be at least 8 characters." }`
- **검증 결과:** 코드 레벨 검증 — `wizard.py:145-155` `len(password) < 8` 조건 확인
- **우선순위:** Medium

---

## 6. FE 복원

### TC-W012 Docker 재시작 후 FE step 복원 (localStorage 기반)
- **전제조건:** Wizard Step 2 완료 후 브라우저 localStorage에 현재 step 저장됨
- **테스트 단계:**
  1. Wizard Step 2까지 진행
  2. `docker compose restart backend` 실행
  3. `http://localhost:5173/wizard` 재접속
- **기대 결과:** localStorage에 저장된 step(3 이후)으로 복원됨 (Step 1부터 재시작하지 않음)
- **우선순위:** Low

---

## 7. 보안 검증

### TC-W013 Wizard 마이그레이션 재실행 차단 (완료 후)
- **전제조건:** Wizard 완료 상태 (`WIZARD_COMPLETED=true` 환경변수 설정됨)
- **테스트 단계:**
  ```bash
  curl -s -X POST http://localhost:5000/api/wizard/migrate
  ```
- **기대 결과:** HTTP 409 반환, `{ "success": false, "data": {}, "error": "Wizard already completed." }`
  - 프로덕션 DB에 재마이그레이션 실행되지 않음
- **비고**: `wizard_phase2.py` `run_migration()`에 `WIZARD_COMPLETED` 환경변수 체크 추가 (commit bd640c4 구현). 완료 전(미설정 상태)에서는 정상 200 반환 (TC-W008 참조)
- **검증 결과**: 수동 확인 완료 (2026-04-08) — WIZARD_COMPLETED=true 상태에서 409 반환 확인
- **우선순위:** High
