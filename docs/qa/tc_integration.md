# 통합 시나리오 TC (tc_integration.md)

**대상:** 사용자↔어드민 크로스 롤 시나리오, end-to-end 흐름
**작성일:** 2026-03-31
**총 TC:** 9개
**환경:** http://localhost:5173 (FE), http://localhost:5000 (BE)

---

## 사전 준비

- Docker 컨테이너 실행: `docker compose up -d`
- 테스트 계정
  - admin: admin/admin123
  - editor1: editor1/pass123
  - editor2: editor2/pass123
- published 포스트 2개 이상 (editor1)

---

## 1. 포스트 생명주기 — editor 작성 ~ admin 강제 삭제

### TC-I001 editor 작성 포스트 admin 강제 삭제 후 통계 안정성 확인
- **전제조건**: editor1 포스트 존재, 포스트에 visit_log 1건 이상 기록됨
- **테스트 단계**:
  1. 비로그인으로 editor1 포스트 조회 (visit_log 생성)
  2. admin이 `DELETE /api/posts/{post_id}` 호출
  3. admin이 `GET /api/admin/stats/editor1` 호출
- **기대 결과**:
  - 포스트 삭제: 200 반환
  - 통계 API: 삭제된 포스트 제외한 나머지 데이터 정상 반환 (500 없음)
- **우선순위**: Medium

---

## 2. 팔로우 → 피드 → visibility 필터 연동

### TC-I002 팔로우 후 피드에서 visibility 필터 검증
- **전제조건**: editor2가 editor1 팔로우, editor1이 public / members_only / private 포스트 각 1개 보유
- **테스트 단계**:
  1. editor2로 `/feed` 진입
  2. 노출 포스트 목록 확인
- **기대 결과**:
  - public 포스트: 피드에 표시
  - members_only 포스트: **피드에 표시** (팔로워는 로그인 사용자이므로 접근 허용)
  - private 포스트: 피드에 **미표시**
  - 오류 없음
- **우선순위**: High

### TC-I009 팔로우 → 피드 확인 → 언팔로우 → 피드 재확인
- **전제조건**: editor2가 editor1 팔로우, editor1이 published 포스트 1개 이상 보유
- **테스트 단계**:
  1. editor2로 `/feed` 진입 → editor1 포스트 확인
  2. `DELETE /api/follows/{editor1_id}` (editor2 토큰으로 언팔로우)
  3. `/feed` 재진입
- **기대 결과**:
  - 팔로우 중: editor1 포스트 피드에 노출
  - 언팔로우 후: editor1 포스트 피드에서 사라짐
- **우선순위**: Medium

---

## 3. 시리즈 + 통계 연동

### TC-I003 시리즈 포스트 조회가 통계 visit_logs에 반영되는지 확인
- **전제조건**: editor1이 시리즈 2화 이상 보유 (published, public)
- **테스트 단계**:
  1. 비로그인으로 시리즈 1화 PostDetail 조회
  2. SeriesNav를 통해 2화로 이동 (클릭)
  3. admin이 `GET /api/admin/stats/editor1` 호출 후 `daily`, `top_posts` 확인
- **기대 결과**:
  - 1화, 2화 각각 visit_log 1건 기록
  - 통계 API: top_posts에 두 포스트 모두 포함 가능 (view_count 반영)
- **우선순위**: Medium

---

## 4. 댓글 게스트 작성 → Admin 승인 → 공개 노출

### TC-I004 게스트 댓글 작성 후 admin 승인까지 전체 흐름
- **전제조건**: published/public 포스트 1개
- **테스트 단계**:
  1. 비로그인으로 `POST /api/comments` (author_name, author_email, author_password, content 포함)
  2. `/posts/{id}` 댓글 목록 확인 (미노출 확인)
  3. admin이 `PUT /api/admin/comments/{id}/approve` 호출
  4. `/posts/{id}` 댓글 목록 재확인
- **기대 결과**:
  - 작성 직후: 댓글 공개 목록에 미표시 (pending 상태)
  - 승인 후: 댓글 공개 목록에 표시
- **우선순위**: High

---

## 5. 블로그 레이아웃 설정 ~ 방문자 관점 확인

### TC-I005 editor가 Magazine 레이아웃 설정 후 비로그인 방문자 확인
- **전제조건**: BUG-1 수정 완료 후 실행. editor1 로그인, published 포스트 3개 이상
- **테스트 단계**:
  1. editor1이 `/my-blog/settings` → \"매거진\" 레이아웃 선택 → 저장
  2. 시크릿 창 (비로그인)으로 `/blog/editor1` 진입
  3. 레이아웃 확인
- **기대 결과**: 비로그인 방문자도 magazine 레이아웃(카드형 포스트)으로 표시됨
- **우선순위**: High

---

## 6. 검색 → 포스트 진입 → visit_log 연동

### TC-I006 검색 결과 클릭 시 visit_log 기록 확인
- **전제조건**: \"Flask 튜토리얼\" 제목 포스트 published
- **테스트 단계**:
  1. `/search?q=Flask` 또는 검색창에 \"Flask\" 입력
  2. 결과에서 \"Flask 튜토리얼\" 클릭 → PostDetail 진입
  3. DB 확인:
     ```bash
     docker compose exec db mariadb -u funnycms -pfunnycms cmsdb \
       -e "SELECT * FROM visit_logs WHERE post_id={id} ORDER BY id DESC LIMIT 3;"
     ```
- **기대 결과**: 검색 결과 클릭도 일반 포스트 조회와 동일하게 visit_log 1건 기록됨
- **우선순위**: Low

---

## 7. 소셜 공유 후 링크 재방문 시 visit_log 중복 방지

### TC-I007 공유 링크 복사 후 같은 날 재방문 시 중복 방지
- **전제조건**: published/public 포스트, 클립보드 권한 허용
- **테스트 단계**:
  1. PostDetail에서 \"🔗 링크 복사\" 클릭 (현재 URL 복사)
  2. 새 탭에 복사된 URL 붙여넣기 → 진입 (첫 방문 — visit_log 1건)
  3. 새로고침 (같은 IP, 당일 재방문)
  4. DB visit_logs 건수 확인:
     ```bash
     docker compose exec db mariadb -u funnycms -pfunnycms cmsdb \
       -e "SELECT COUNT(*) FROM visit_logs WHERE post_id={id};"
     ```
- **기대 결과**: visit_log 1건만 유지 (중복 삽입 없음), view_count는 매 조회마다 증가
- **비고**: BUG-5 — DB UNIQUE 제약 미구현, BE 코드 레벨(SELECT→INSERT)로만 방어함. 의도적 결정. 동시 요청 발생 시 드물게 중복 가능성 있음.
- **우선순위**: Medium

---

## 8. RSS 피드 (BUG-2 연관)

### TC-I008 RSS 피드 응답 및 base_url 확인
- **전제조건**: editor1 published 포스트 1개 이상
- **테스트 단계**:
  1. `GET /blog/editor1/feed.xml` 호출 (또는 브라우저에서 직접 진입)
  2. 응답 XML 확인 — `<link>` 태그의 URL 확인
- **기대 결과**:
  - 200 반환, Content-Type: `application/rss+xml`
  - RSS 항목이 1개 이상 존재
  - ⚠️ BUG-2 수정 전: `<link>` 태그가 `http://localhost:5173/...` 하드코딩 URL 포함 (프로덕션에서 잘못된 링크)
  - BUG-2 수정 후: `<link>` 태그가 환경변수 또는 요청 기반 URL (`request.host_url`) 사용
- **비고**: BUG-2 — `backend/api/feeds.py` line 29: `base_url = "http://localhost:5173"` 하드코딩. 프로덕션 배포 시 모든 RSS 링크가 localhost를 가리키는 결함.
- **우선순위**: Medium
