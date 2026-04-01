## QA 규칙 및 프로세스

**최종 업데이트:** 2026-04-01
**작성자:** planner-2 (팀원 의견 취합)
**참조 파일:** `docs/qa/tc_sprint3.md` (인덱스), `tc_user.md`, `tc_admin.md`, `tc_integration.md`

---

## 1. 테스트 환경

### 사전 요구사항

```bash
# 컨테이너 실행 확인 (필수)
docker compose up -d
docker compose ps  # 모든 컨테이너 healthy 상태 확인

# 테스트 계정 (초기 설정 시)
# admin: admin/admin123 (role=admin)
# editor1: editor1/pass123 (포스트 작성자)
# editor2: editor2/pass123 (팔로우 테스트용)
```

### 접속 정보

| 서비스 | URL |
|--------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:5000 |
| DB (직접) | `docker compose exec db mariadb -u funnycms -pfunnycms cmsdb` |

### DB 확인 쿼리 패턴

```bash
# visit_logs 확인
docker compose exec db mariadb -u funnycms -pfunnycms cmsdb \
  -e "SELECT * FROM visit_logs WHERE post_id={id} ORDER BY id DESC LIMIT 5;"

# 테스트 데이터 초기화 (주의: 전체 삭제)
docker compose exec db mariadb -u funnycms -pfunnycms cmsdb \
  -e "DELETE FROM visit_logs; DELETE FROM follows;"
```

---

## 2. TC 파일 구조 및 네이밍 규칙

### 파일 구성

| 파일 | 대상 | 위치 |
|------|------|------|
| `tc_sprint3.md` | 인덱스 + BUG 이슈 추적 | `docs/qa/` |
| `tc_user.md` | editor / visitor TC | `docs/qa/` |
| `tc_admin.md` | admin TC | `docs/qa/` |
| `tc_integration.md` | 크로스 롤 통합 시나리오 TC | `docs/qa/` |
| `tc_wizard.md` | Setup Wizard 초기 설치 플로우 TC | `docs/qa/` |

### TC 네이밍 컨벤션

- **TC-U001~**: 사용자(editor/visitor) 기능 테스트
- **TC-A001~**: admin 기능 테스트
- **TC-I001~**: 크로스 롤 통합 시나리오
- **TC-W001~**: Setup Wizard 초기 설치 플로우

**TC 구성 요소 (필수):**
```markdown
### TC-U001 TC 제목
- **전제조건**: 테스트 실행 전 필요한 상태
- **테스트 단계**: 번호 매긴 실행 절차
- **기대 결과**: 검증 기준 (구체적인 HTTP 상태코드 또는 UI 상태)
- **우선순위**: High / Medium / Low
```

---

## 3. BUG 추적

### BUG 등록 형식

`tc_sprint3.md`의 "이슈 추적" 표에 다음 형식으로 등록:

| BUG | 심각도 | 상태 | 관련 TC |
|-----|--------|------|---------|
| BUG-N: 제목 | HIGH/MEDIUM/LOW | 미수정/수정 중/완료(commit)/의도적 결정 | TC-XXXX |

### 심각도 기준

| 심각도 | 기준 |
|--------|------|
| **HIGH** | 핵심 기능 동작 불가, 데이터 손실, 보안 결함 |
| **MEDIUM** | 기능 오작동이지만 우회 가능, 외부 연동 오류 |
| **LOW** | UI 이슈, 성능 저하, 엣지 케이스 |

### 현재 이슈 목록

> **최종 업데이트:** 2026-04-01 (tc_sprint3.md 기준 동기화)

| BUG | 심각도 | 상태 | 설명 |
|-----|--------|------|------|
| BUG-1 | HIGH | 완료 (commit 35a84de, QA PASS 2026-04-01) | blog_layout magazine/photo 허용값 누락 |
| BUG-2 | MEDIUM | 완료 (commit 2c9dc2d, QA PASS 2026-04-01) | RSS `base_url` 하드코딩 (`feeds.py:29`) — 프로덕션 링크 오류 |
| BUG-3 | MEDIUM | 완료 (commit 2c9dc2d, QA PASS 2026-04-01) | 포스트 다중 시리즈 할당 시 500 에러 |
| BUG-4 | LOW | 완료 (commit 6baed90, QA PASS 2026-04-01) | VisitLog 예외 시 view_count만 증가하는 롤백 문제 |
| BUG-5 | LOW | 의도적 결정 | VisitLog DB UNIQUE 미구현 — BE 레벨 중복 방지로 대체 |
| BUG-6 | MEDIUM | 완료 (commit 176cef6, QA PASS 2026-04-01) | 시리즈 라우트 미등록 (`/blog/:username/series/:slug` App.jsx 누락) |

---

## 4. TC 실행 순서 및 우선순위 기준

### 실행 순서

1. **High** 우선순위 TC 먼저 실행 (핵심 기능 검증)
2. **Medium** TC 실행 (정상 흐름 확인)
3. **Low** TC 실행 (엣지 케이스)

### 우선순위 분류 기준

| 우선순위 | 기준 |
|----------|------|
| **High** | 기획 핵심 기능, 보안 권한 검증, 데이터 무결성, 크로스 롤 접근 차단 |
| **Medium** | 정상 사용자 흐름, UI 피드백, 설정 저장/반영 |
| **Low** | 엣지 케이스, 소셜 공유 포맷, 검색 없을 때 빈 상태 |

### BUG 조건부 TC

BUG 수정이 전제조건인 TC는 명시적으로 표기:
```
- **전제조건**: BUG-1 수정 완료 후 실행
```
BUG 미수정 상태에서는 해당 TC를 **Skip** 처리하고 이슈 추적에 기록.

---

## 5. 회귀 테스트 기준

### 신규 기능 추가 시 재실행 필수 TC

| 변경 영역 | 재실행 TC 범위 |
|-----------|--------------|
| 인증/권한 (auth.py, decorators.py) | TC-A007, TC-A011, TC-A012, TC-A014, TC-A016, TC-A017 |
| 포스트 CRUD (posts.py) | TC-U012~TC-U015 (visit_logs), TC-A003 |
| 팔로우/피드 (follows.py) | TC-U031~TC-U035, TC-I002 |
| 시리즈 (series.py) | TC-U001~TC-U006, TC-I003 |
| 통계 (stats.py) | TC-U007~TC-U011, TC-A013, TC-A014, TC-I001 |
| 블로그 설정 (auth.py PUT /me) | TC-U026~TC-U030 |
| 레이아웃 (blog_layout) | TC-U021~TC-U025, TC-I005 |
| 사이트 스킨/설정 (settings.py) | TC-A010, TC-A011 |

### 마이그레이션 변경 시 확인 항목

1. `flask db upgrade` 정상 완료 확인
2. 변경된 테이블/컬럼 관련 TC 재실행
3. 기존 데이터 호환성 확인 (nullable 컬럼 추가 시 기존 레코드 NULL 여부)

---

## 6. API 테스트 주의사항 (Backend)

### JWT 토큰 처리

```bash
# 로그인 후 토큰 발급
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"editor1","password":"pass123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

# 인증 필요 API 호출
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/posts/mine
```

### visibility 필터 동작

| 상태 | public | members_only | private |
|------|--------|-------------|---------|
| 비로그인 | ✅ | ❌ | ❌ |
| 로그인(타인) | ✅ | ✅ | ❌ |
| 본인/admin | ✅ | ✅ | ✅ |

### 응답 포맷 검증

모든 API 응답은 다음 포맷을 따라야 함:
```json
{ "success": true/false, "data": {}, "error": "" }
```

---

## 7. FE 테스트 주의사항 (Frontend)

### 브라우저 환경

- **권장 브라우저**: Chrome 최신 버전
- **시크릿 창**: 비로그인/로컬스토리지 초기화 필요 시 사용
- **해상도**: 1280×800 이상 (레이아웃 TC 기준)

### 로컬스토리지 초기화

```javascript
// 브라우저 콘솔에서 실행
localStorage.clear();
location.reload();
```

### React StrictMode 주의

개발 환경(`docker compose watch`)에서 `useEffect` 2회 실행:
- **view_count**: 포스트 상세 진입 시 +2로 보일 수 있음 → 정상 (프로덕션에서는 +1)
- **visit_logs**: 동일하게 2건 INSERT 시도될 수 있음 → BE 레벨 중복 방지로 1건만 기록

### 클립보드 권한

TC-U019 (링크 복사) 실행 전: 브라우저 주소창에서 클립보드 권한 허용 필요.

---

## 8. TC 작성 가이드

### 신규 TC 추가 시 체크리스트

- [ ] TC 번호 순서 확인 (기존 최대 번호 + 1)
- [ ] 전제조건 명확히 기술 (어떤 데이터/계정이 필요한지)
- [ ] 기대 결과에 구체적인 HTTP 상태코드 또는 UI 상태 명시
- [ ] BUG 의존성이 있으면 전제조건에 명시 (`BUG-N 수정 완료 후 실행`)
- [ ] tc_sprint3.md 인덱스에 매핑 추가

### TC 수정 시 체크리스트

- [ ] tc_sprint3.md TC 번호 매핑 테이블 동기화
- [ ] 관련 BUG 이슈 추적 상태 업데이트
- [ ] 총 TC 수 헤더 업데이트
