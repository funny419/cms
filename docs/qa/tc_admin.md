# 어드민 기능 TC (tc_admin.md)

**대상:** admin 계정
**작성일:** 2026-03-31
**총 TC:** 20개
**환경:** http://localhost:5173 (FE), http://localhost:5000 (BE)

---

## 사전 준비

- Docker 컨테이너 실행: `docker compose up -d`
- 테스트 계정
  - admin: admin/admin123 (role=admin)
  - editor1: editor1/pass123 (포스트 작성자)
  - editor2: editor2/pass123 (타인 계정)
- editor1 포스트 3개 이상 사전 등록 (draft/published 혼재)
- 게스트 댓글 1개 이상 (status=pending)

---

## 1. Admin 포스트 관리

### TC-A001 포스트 목록 키워드 검색
- **전제조건**: admin 로그인, `GET /api/admin/posts?q=Flask` 호출 가능한 포스트 존재
- **테스트 단계**:
  1. `/admin/posts` 진입
  2. 검색창에 \"Flask\" 입력 (300ms 디바운스)
  3. 결과 확인
- **기대 결과**: \"Flask\"가 제목에 포함된 포스트만 표시, 다른 포스트 미표시
- **우선순위**: High

### TC-A002 포스트 목록 상태 필터 (status)
- **전제조건**: admin 로그인, draft 포스트 1개 이상, published 포스트 1개 이상 존재
- **테스트 단계**:
  1. `/admin/posts` 진입
  2. 상태 필터 \"draft\" 선택
  3. \"published\" 선택 후 비교
- **기대 결과**:
  - draft 필터: draft 포스트만 표시
  - published 필터: published 포스트만 표시
  - 각 상태별 미해당 포스트 미표시
- **우선순위**: High

### TC-A003 Admin — 타인 포스트 강제 삭제
- **전제조건**: admin 로그인, editor1 포스트 존재
- **테스트 단계**:
  1. `DELETE /api/posts/{editor1_post_id}` (admin 토큰)
  2. 응답 확인
  3. 해당 포스트 조회 확인
- **기대 결과**: 200 반환, 포스트 삭제됨 (GET → 404)
- **우선순위**: High

### TC-A015 Editor — 타인 포스트 삭제 시 403
- **전제조건**: editor2 로그인, editor1 포스트 존재
- **테스트 단계**:
  1. editor2 토큰으로 `DELETE /api/posts/{editor1_post_id}` 호출
- **기대 결과**: 403 Forbidden 반환, 포스트 삭제되지 않음
- **우선순위**: High

---

## 2. Admin 회원 관리

### TC-A004 회원 역할 변경 (editor → admin)
- **전제조건**: admin 로그인, editor1 계정 존재
- **테스트 단계**:
  1. `PUT /api/admin/users/{editor1_id}/role` body: `{"role": "admin"}` (admin 토큰)
  2. 응답 확인
  3. editor1로 로그인 후 `/admin/posts` 접근 확인
- **기대 결과**: 200 반환, editor1이 admin 페이지 접근 가능
- **우선순위**: Medium

### TC-A005 회원 비활성화 (deactivated)
- **전제조건**: admin 로그인, editor2 계정 존재
- **테스트 단계**:
  1. `PUT /api/admin/users/{editor2_id}/deactivate` (admin 토큰)
  2. 응답 확인
  3. editor2로 로그인 시도
- **기대 결과**:
  - 비활성화 API: 200 반환
  - editor2 로그인 시도: **401** 반환 (인증 차단)
- **우선순위**: High

### TC-A006 회원 삭제
- **전제조건**: admin 로그인, 삭제 대상 계정 존재 (포스트 없음 권장)
- **테스트 단계**:
  1. `DELETE /api/admin/users/{target_id}` (admin 토큰)
  2. 응답 확인
  3. `GET /api/auth/users/{target_username}` 확인
- **기대 결과**: 200 반환, 이후 유저 조회 404
- **우선순위**: Medium

### TC-A007 Admin이 아닌 editor 회원 관리 API 접근 불가
- **전제조건**: editor1 로그인
- **테스트 단계**:
  1. editor1 토큰으로 `PUT /api/admin/users/{id}/role` 호출
  2. editor1 토큰으로 `PUT /api/admin/users/{id}/deactivate` 호출
  3. editor1 토큰으로 `DELETE /api/admin/users/{id}` 호출
- **기대 결과**: 세 요청 모두 403 Forbidden 반환
- **우선순위**: High

---

## 3. Admin 댓글 관리

### TC-A008 게스트 댓글 승인 (pending → approved)
- **전제조건**: admin 로그인, status=pending 게스트 댓글 존재
- **테스트 단계**:
  1. `/admin/comments` 진입 → pending 댓글 확인
  2. \"승인\" 버튼 클릭 (또는 `PUT /api/admin/comments/{id}/approve`)
  3. 댓글 상태 확인
- **기대 결과**: 200 반환, 댓글 status → approved, `/posts/{id}` 댓글 목록에 노출
- **우선순위**: High

### TC-A009 게스트 댓글 스팸 처리 (pending → spam)
- **전제조건**: admin 로그인, status=pending 게스트 댓글 존재
- **테스트 단계**:
  1. \"거절(스팸)\" 버튼 클릭 (또는 `PUT /api/admin/comments/{id}/reject`)
  2. 댓글 상태 확인
- **기대 결과**: 200 반환, 댓글 status → spam, 공개 댓글 목록 미노출
- **우선순위**: High

---

## 4. Admin 사이트 설정

### TC-A010 사이트 스킨 변경 (notion → forest)
- **전제조건**: admin 로그인
- **테스트 단계**:
  1. `/admin/settings` 진입
  2. 스킨 \"forest\" 선택 → 저장
  3. 비로그인 브라우저에서 `http://localhost:5173` 진입
- **기대 결과**: 사이트 전체에 forest 스킨(초록 계열) 적용, 새로고침 후에도 유지
- **우선순위**: Medium

### TC-A011 사이트 스킨 API 비인가 접근 차단
- **전제조건**: editor1 로그인
- **테스트 단계**:
  1. editor1 토큰으로 `PUT /api/settings` body: `{"site_skin": "ocean"}` 호출
- **기대 결과**: 403 Forbidden 반환
- **우선순위**: High

---

## 5. 계정 상태 및 권한

### TC-A012 deactivated 계정 JWT 사용 차단
- **전제조건**: editor1 토큰 발급 후 admin이 editor1을 deactivated 처리
- **테스트 단계**:
  1. editor1 토큰 발급 (로그인)
  2. admin으로 editor1 비활성화 (`PUT /api/admin/users/{id}/deactivate`)
  3. 기존 editor1 토큰으로 `GET /api/posts/mine` 호출
- **기대 결과**: 기존 토큰으로도 API 접근 차단 — **403** 반환 (roles_required 데코레이터가 deactivated 차단)
- **우선순위**: High

---

## 6. Admin 통계 조회

### TC-A013 Admin 전체 유저 통계 조회
- **전제조건**: admin 로그인
- **테스트 단계**:
  1. `GET /api/admin/stats/editor1` (admin 토큰)
- **기대 결과**: 200 반환, `daily`, `top_posts`, `total_views`, `total_posts`, `follower_count`, `total_comments` 필드 포함
- **우선순위**: Medium

### TC-A014 Admin 통계 API — editor 접근 불가
- **전제조건**: editor1 로그인
- **테스트 단계**:
  1. editor1 토큰으로 `GET /api/admin/stats/editor1` 호출
- **기대 결과**: 403 Forbidden 반환
- **우선순위**: High

### TC-A016 통계 API — 비인증 접근 차단
- **전제조건**: 토큰 없음 (비로그인)
- **테스트 단계**:
  1. 토큰 없이 `GET /api/blog/editor1/stats` 호출
- **기대 결과**: 401 Unauthorized 반환
- **우선순위**: High

### TC-A017 통계 API — 타인 editor 접근 차단
- **전제조건**: editor2 로그인
- **테스트 단계**:
  1. editor2 토큰으로 `GET /api/blog/editor1/stats` 호출
- **기대 결과**: 403 Forbidden 반환 (본인 통계만 조회 가능)
- **우선순위**: High

---

## 7. 보안 검증

### TC-A018 MIME 위장 파일 업로드 차단
- **전제조건**: editor 로그인, 파일 업로드 권한 보유
- **테스트 단계**:
  ```bash
  TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"editor1","password":"pass123"}' \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

  # .txt 파일 내용을 image/jpeg Content-Type으로 위장하여 업로드
  curl -s -X POST http://localhost:5000/api/media \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@/tmp/fake.txt;type=image/jpeg"
  ```
  - 사전 준비: `echo "not an image" > /tmp/fake.txt`
- **기대 결과**: HTTP 400 반환, 파일 저장 안됨
  - 응답: `{ "success": false, "error": "허용되지 않는 파일 형식입니다." }` (또는 유사 메시지)
  - `backend/uploads/` 디렉토리에 파일 없음 확인
- **비고**: `python-magic` 기반 magic bytes 검증 (commit 31c3cbf 구현). `Content-Type` 헤더가 아닌 실제 파일 내용으로 판별
- **우선순위**: High

### TC-A019 파일 크기 제한 초과 업로드 차단
- **전제조건**: editor 로그인
- **테스트 단계**:
  1. **BE 직접 검증**:
     ```bash
     TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
       -H "Content-Type: application/json" \
       -d '{"username":"editor1","password":"pass123"}' \
       | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

     # 11MB 더미 파일 생성 후 업로드 시도
     dd if=/dev/zero bs=1024 count=11264 > /tmp/big_file.jpg 2>/dev/null
     curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:5000/api/media \
       -H "Authorization: Bearer $TOKEN" \
       -F "file=@/tmp/big_file.jpg;type=image/jpeg"
     ```
  2. **FE 검증** (브라우저):
     - PostEditor → 이미지 업로드 버튼 → 10MB 초과 파일 선택
     - 업로드 버튼 클릭 전 에러 메시지 확인
- **기대 결과**:
  - BE: HTTP 413 (Request Entity Too Large) 반환
  - FE: 파일 선택 직후 "파일 크기는 10MB를 초과할 수 없습니다" (또는 유사) 에러 메시지 표시, API 호출 없음
- **비고**: `config.py MAX_CONTENT_LENGTH=10MB` + Nginx `client_max_body_size 10m` (commit 13dce39/bd640c4 구현). FE 클라이언트 검증은 commit 524f030 구현
- **우선순위**: High

### TC-A020 Rate Limiting — 로그인 브루트포스 차단
- **전제조건**: 없음 (비로그인)
- **테스트 단계**:
  ```bash
  # 11회 연속 로그인 시도 (10회까지는 401, 11회째는 429)
  for i in $(seq 1 11); do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:5000/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"username":"wronguser","password":"wrongpass"}')
    echo "Request $i: $CODE"
  done
  ```
- **기대 결과**:
  - 1~10회: HTTP 401 반환 (잘못된 인증 정보)
  - 11회째: HTTP 429 반환
  - ⚠️ **BUG-7 (미수정)**: 현재 429 응답이 HTML 형식 (`<!doctype html>...`) — JSON `{"success": false, "error": "Too Many Requests"}` 형식으로 수정 필요
- **비고**: Flask-Limiter `10/minute` 적용 (commit 31c3cbf 구현). E2E 테스트 실행 시 병렬 워커로 인한 rate limit 조기 발동 현상 확인됨 (BUG-7 관련)
- **우선순위**: High
