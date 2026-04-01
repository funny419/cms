# 사용자 기능 TC (tc_user.md)

**대상:** editor / visitor (비로그인 방문자)
**작성일:** 2026-03-31
**총 TC:** 50개
**환경:** http://localhost:5173 (FE), http://localhost:5000 (BE)

---

## 사전 준비

- Docker 컨테이너 실행: `docker compose up -d`
- 테스트 계정
  - editor1: editor1/pass123 (포스트 작성자)
  - editor2: editor2/pass123 (팔로우 테스트용)
- published 포스트 2개 이상 사전 등록 (editor1)

---

## 1. 포스트 시리즈

### TC-U001 시리즈 생성 — PostEditor
- **전제조건**: editor1 로그인, 포스트 1개 이상
- **테스트 단계**:
  1. `/posts/new` 또는 기존 포스트 편집 진입
  2. 시리즈 드롭다운 클릭
  3. \"새 시리즈 만들기\" 선택 → 제목 \"Python 튜토리얼\" 입력 → 확인
  4. 포스트 저장
- **기대 결과**: 드롭다운에 \"Python 튜토리얼\" 표시됨 (인라인 생성 후 드롭다운 목록에 즉시 추가 — 별도 페이지 이동 없음), 저장 후 시리즈 연결됨. ※ 별도 시리즈 생성 페이지로 이동하는 UX는 없음.
- **우선순위**: High

### TC-U002 시리즈에 두 번째 포스트 추가
- **전제조건**: TC-U001 완료, editor1 로그인
- **테스트 단계**:
  1. 새 포스트 작성 페이지 진입
  2. 시리즈 드롭다운에서 \"Python 튜토리얼\" 선택
  3. 포스트 제목 \"Python 2화\" 입력 후 저장
- **기대 결과**: 시리즈에 포스트 2개, 각 포스트 PostDetail에 SeriesNav 표시
- **우선순위**: High

### TC-U003 SeriesNav — 이전/다음 탐색
- **전제조건**: 시리즈에 포스트 3개 이상
- **테스트 단계**:
  1. 시리즈 중간 포스트 PostDetail 진입
  2. SeriesNav 컴포넌트 확인
  3. \"이전 포스트\" 클릭 → 이동 확인
  4. \"다음 포스트\" 클릭 → 이동 확인
- **기대 결과**:
  - 첫 번째 포스트: 이전 없음, 다음 표시
  - 마지막 포스트: 이전 표시, 다음 없음
  - 중간 포스트: 양방향 표시 + 이동 정확
- **우선순위**: High

### TC-U004 BlogHome 시리즈 섹션
- **전제조건**: editor1 시리즈 1개 이상, `/blog/editor1` 접근 가능
- **테스트 단계**:
  1. `/blog/editor1` 진입
  2. 시리즈 섹션 확인
  3. 시리즈 클릭
- **기대 결과**: 시리즈 목록 + 포스트 수 표시, 클릭 시 시리즈 첫 포스트 이동
- **우선순위**: Medium

### TC-U005 타인 시리즈 수정/삭제 불가
- **전제조건**: editor1이 시리즈 보유, editor2 로그인
- **테스트 단계**:
  1. editor2 토큰으로 `PUT /api/series/{id}` 호출
  2. editor2 토큰으로 `DELETE /api/series/{id}` 호출
- **기대 결과**: 403 Forbidden 반환
- **우선순위**: High

### TC-U006 시리즈 삭제 후 포스트 SeriesNav 제거
- **전제조건**: editor1 로그인, 시리즈 1개 보유
- **테스트 단계**:
  1. `DELETE /api/series/{id}` 호출
  2. 기존 시리즈에 속했던 포스트 PostDetail 재방문
- **기대 결과**: SeriesNav 사라짐, 포스트 자체는 정상 조회
- **우선순위**: Medium

### TC-U042 BUG-3 재현 — 포스트 다중 시리즈 추가 시 500 오류
- **전제조건**: editor1 로그인, 포스트 1개, 시리즈 2개 보유
- **테스트 단계**:
  1. 시리즈 A에 포스트 추가: `POST /api/series/{series_a_id}/posts` body: `{"post_id": {pid}}`
  2. 시리즈 B에 동일 포스트 추가: `POST /api/series/{series_b_id}/posts` body: `{"post_id": {pid}}`
  3. `GET /api/posts/{pid}` 호출
- **기대 결과** (BUG-3 수정 전): Step 3에서 500 Internal Server Error 발생 (`MultipleResultsFound` — scalar_one_or_none 위반)
- **비고**: BUG-3 수정 후에는 첫 번째 시리즈 정보 반환 또는 409 방어 처리 기대. 이 TC는 BUG-3 수정 검증 기준으로 활용.
- **우선순위**: High

---

## 2. 블로그 통계 대시보드

### TC-U007 통계 대시보드 진입
- **전제조건**: editor1 로그인, published 포스트 최소 1개, 해당 포스트에 방문 기록 있음 (TC-U012 이후 실행 권장)
- **테스트 단계**:
  1. `/my-blog/statistics` 진입
- **기대 결과**: 대시보드 로드, recharts 차트 렌더링 확인
- **우선순위**: High

### TC-U008 period 필터 전환
- **전제조건**: TC-U007 완료
- **테스트 단계**:
  1. \"7일\" 선택 → 차트 확인
  2. \"30일\" 선택 → 차트 변경 확인
  3. \"90일\" 선택 → 차트 변경 확인
- **기대 결과**: 각 period 전환 시 API 재호출, 차트 데이터 변경
- **우선순위**: High

### TC-U009 타인의 통계 직접 접근 차단
- **전제조건**: editor2 로그인
- **테스트 단계**:
  1. editor2 토큰으로 `GET /api/blog/editor1/stats` 호출
- **기대 결과**: 403 Forbidden 반환
- **우선순위**: High

### TC-U010 포스트 없을 때 통계 빈 상태
- **전제조건**: 포스트 없는 신규 editor 계정
- **테스트 단계**:
  1. `/my-blog/statistics` 진입
- **기대 결과**: 0값 또는 \"데이터 없음\" 표시, 오류 없음
- **우선순위**: Medium

### TC-U011 Top 10 포스트 목록
- **전제조건**: editor1 published 포스트 2개 이상, 조회수 다름
- **테스트 단계**:
  1. `/my-blog/statistics` → \"인기 포스트\" 섹션 확인
- **기대 결과**: view_count 내림차순 정렬, 제목·조회수 표시
- **우선순위**: Medium

---

## 3. visit_logs 수집

### TC-U012 포스트 조회 시 방문 로그 기록
- **전제조건**: published 포스트 1개
- **테스트 단계**:
  1. `/posts/{id}` 진입
  2. DB 확인:
     ```bash
     docker compose exec db mariadb -u funnycms -pfunnycms cmsdb \
       -e "SELECT * FROM visit_logs WHERE post_id={id};"
     ```
- **기대 결과**: visit_log 1건 INSERT, ip_address·post_id·visited_at 값 있음
- **비고**: 개발 환경(React StrictMode)에서 `view_count`가 +2로 보이는 것은 정상 — useEffect 2회 실행. 프로덕션 빌드에서는 +1.
- **우선순위**: Medium

### TC-U013 동일 IP + 당일 재방문 중복 방지
- **전제조건**: TC-U012 완료 (이미 1건 기록됨)
- **테스트 단계**:
  1. 같은 브라우저에서 동일 포스트 새로고침
  2. DB visit_logs 재확인:
     ```bash
     docker compose exec db mariadb -u funnycms -pfunnycms cmsdb \
       -e "SELECT COUNT(*) FROM visit_logs WHERE post_id={id};"
     ```
- **기대 결과**: 건수 증가 없음 (1건 유지), view_count는 계속 증가
- **비고**: BUG-5 — DB UNIQUE 제약 미구현, BE 코드 레벨(SELECT→INSERT)로만 방어함. 의도적 결정. 동시 요청 발생 시 드물게 중복 가능성 있음.
- **우선순위**: High

### TC-U014 편집 페이지 진입 시 방문 로그 미기록
- **전제조건**: editor1 로그인, 본인 포스트 존재
- **테스트 단계**:
  1. `/posts/{id}/edit` 진입 (skip_count=1 자동 적용)
  2. DB visit_logs 확인:
     ```bash
     docker compose exec db mariadb -u funnycms -pfunnycms cmsdb \
       -e "SELECT COUNT(*) FROM visit_logs WHERE post_id={id};"
     ```
- **기대 결과**: visit_log 추가 없음, view_count 미증가
- **우선순위**: Medium

### TC-U015 비로그인 방문자 로그 기록
- **전제조건**: published/public 포스트
- **테스트 단계**:
  1. 로그아웃 후 포스트 직접 URL 진입
  2. DB visit_logs 확인:
     ```bash
     docker compose exec db mariadb -u funnycms -pfunnycms cmsdb \
       -e "SELECT user_id, ip_address FROM visit_logs WHERE post_id={id} ORDER BY id DESC LIMIT 1;"
     ```
- **기대 결과**: user_id=NULL로 visit_log 기록
- **우선순위**: Medium

### TC-U043 members_only 포스트 비로그인 접근 차단
- **전제조건**: editor1이 `visibility=members_only` 포스트 published 상태
- **테스트 단계**:
  1. 로그아웃 상태에서 `GET /api/posts/{id}` 호출 (토큰 없음)
  2. 응답 코드 확인
  3. 비로그인으로 `/posts/{id}` FE 진입 확인
- **기대 결과**:
  - API: 401 또는 403 반환 (포스트 내용 미반환)
  - FE: 로그인 유도 메시지 또는 리다이렉트
- **우선순위**: High

---

## 4. 소셜 공유 버튼

### TC-U016 Twitter 공유 링크 정상 생성
- **전제조건**: PostDetail 진입
- **테스트 단계**:
  1. 하단 \"이 글 공유하기\" 섹션 확인
  2. \"Twitter\" 버튼 링크 확인 (오른쪽 클릭 → 링크 주소 복사)
- **기대 결과**: `https://twitter.com/intent/tweet?url={인코딩URL}&text={인코딩제목}` 형식
- **우선순위**: Medium

### TC-U017 Facebook 공유 링크 정상 생성
- **전제조건**: PostDetail 진입
- **테스트 단계**:
  1. \"Facebook\" 버튼 링크 확인
- **기대 결과**: `https://www.facebook.com/sharer/sharer.php?u={인코딩URL}` 형식
- **우선순위**: Low

### TC-U018 LinkedIn 공유 링크 정상 생성
- **전제조건**: PostDetail 진입
- **테스트 단계**:
  1. \"LinkedIn\" 버튼 링크 확인
- **기대 결과**: `https://www.linkedin.com/shareArticle?url={인코딩URL}&title={인코딩제목}` 형식
- **우선순위**: Low

### TC-U019 링크 복사 + 2초 피드백
- **전제조건**: PostDetail 진입, 클립보드 권한 허용
- **테스트 단계**:
  1. \"🔗 링크 복사\" 버튼 클릭
  2. 버튼 텍스트 변화 확인
  3. 2초 후 상태 확인
  4. Ctrl+V로 복사된 URL 확인
- **기대 결과**:
  - 클릭 즉시: \"✓ 복사됨!\" 표시
  - 2초 후: \"🔗 링크 복사\" 복귀
  - 클립보드: 현재 페이지 URL
- **우선순위**: Medium

### TC-U020 한글 제목 포스트 공유 URL 인코딩
- **전제조건**: 한글 제목 포스트 (예: \"파이썬 튜토리얼\") PostDetail
- **테스트 단계**:
  1. Twitter 공유 링크 확인
- **기대 결과**: `%ED%8C%8C...` 등 URL 인코딩됨, 깨진 문자 없음
- **우선순위**: Medium

---

## 5. 블로그 레이아웃 A/B/C/D

### TC-U021 레이아웃 Default (A) 적용
- **전제조건**: editor1 로그인
- **테스트 단계**:
  1. `/my-blog/settings` → \"기본(Default)\" 선택 → 저장
  2. `/blog/editor1` 진입
- **기대 결과**: 좌측 카테고리/태그 사이드바 + 포스트 목록
- **우선순위**: Medium

### TC-U022 레이아웃 Compact (B) 적용
- **전제조건**: editor1 로그인
- **테스트 단계**:
  1. `/my-blog/settings` → \"콤팩트\" 선택 → 저장
  2. `/blog/editor1` 진입
- **기대 결과**: 사이드바 숨겨짐, 포스트 목록만 표시
- **우선순위**: High

### TC-U023 레이아웃 Magazine (D) 적용
- **전제조건**: editor1 로그인, BUG-1 수정 완료 후 실행
- **테스트 단계**:
  1. `/my-blog/settings` → \"매거진\" 선택 → 저장
  2. `/blog/editor1` 진입
- **기대 결과**: 카드형 메인 포스트 + 리스트 형태
- **우선순위**: High

### TC-U024 레이아웃 Photo (C) 적용
- **전제조건**: editor1 포스트에 thumbnail_url 설정됨, BUG-1 수정 완료 후 실행
- **테스트 단계**:
  1. \"포토\" 레이아웃 선택 → 저장
  2. `/blog/editor1` 진입
- **기대 결과**: 큼직한 썸네일 그리드 형태
- **우선순위**: High

### TC-U025 레이아웃 설정 유지 (새로고침)
- **전제조건**: TC-U022~U024 중 하나 완료
- **테스트 단계**:
  1. 레이아웃 변경 후 `/blog/editor1` 새로고침
- **기대 결과**: 선택한 레이아웃 유지 (DB blog_layout 저장 확인)
- **우선순위**: High

---

## 6. 블로그 커스터마이제이션

### TC-U026 블로그 제목 설정 및 반영
- **전제조건**: editor1 로그인
- **테스트 단계**:
  1. `/my-blog/settings` → \"기본 정보\" 탭
  2. 블로그 제목 \"나의 개발 블로그\" 입력 → 저장
  3. `/blog/editor1` 진입
- **기대 결과**: 블로그 홈 헤더에 \"나의 개발 블로그\" 표시
- **우선순위**: High

### TC-U027 블로그 대표 색상 설정
- **전제조건**: editor1 로그인
- **테스트 단계**:
  1. `/my-blog/settings` → \"디자인\" 탭
  2. 색상 `#3b82f6` 입력 → 저장
  3. `/blog/editor1` 진입
- **기대 결과**: 배너/강조 색상이 파란색 계열로 변경
- **우선순위**: Medium

### TC-U028 blog_color 잘못된 형식 입력 시 오류
- **전제조건**: editor1 로그인
- **테스트 단계**:
  1. `PUT /api/auth/me` body: `{"blog_color": "blue"}` 호출
- **기대 결과**: 400 + \"blog_color는 #rrggbb 형식\" 오류 메시지
- **우선순위**: Medium

### TC-U029 SNS 링크 설정 및 ProfileCard 반영
- **전제조건**: editor1 로그인
- **테스트 단계**:
  1. GitHub URL `https://github.com/testuser` 입력 → 저장
  2. `/blog/editor1` → ProfileCard 확인
- **기대 결과**: ProfileCard에 GitHub 링크 표시, 클릭 시 GitHub 이동
- **우선순위**: Medium

### TC-U030 웹사이트 URL 설정
- **전제조건**: editor1 로그인
- **테스트 단계**:
  1. website_url `https://myblog.dev` 입력 → 저장
  2. `/blog/editor1` → ProfileCard 확인
- **기대 결과**: 웹사이트 링크 표시
- **우선순위**: Low

---

## 7. 팔로우 / 이웃 피드

### TC-U031 팔로우/언팔로우 토글
- **전제조건**: editor2 로그인, `/blog/editor1` 방문
- **테스트 단계**:
  1. ProfileCard \"팔로우\" 버튼 클릭
  2. 버튼 상태 확인
  3. 다시 클릭 (언팔로우)
- **기대 결과**:
  - 팔로우 후: \"팔로잉 ✓\" 버튼, 팔로워 수 +1
  - 언팔로우 후: \"팔로우\" 버튼, 팔로워 수 -1
- **우선순위**: High

### TC-U032 본인 팔로우 불가
- **전제조건**: editor1 로그인
- **테스트 단계**:
  1. `/blog/editor1` 진입 (본인 블로그)
  2. ProfileCard 팔로우 버튼 확인
- **기대 결과**: 팔로우 버튼 미표시 또는 비활성화
- **우선순위**: High

### TC-U033 이웃 피드 포스트 노출
- **전제조건**: editor2가 editor1 팔로우, editor1 포스트 발행됨
- **테스트 단계**:
  1. editor2 로그인 → `/feed` 진입
- **기대 결과**: editor1의 published + public/members_only 포스트 노출
- **우선순위**: High

### TC-U034 피드 — private 포스트 미노출
- **전제조건**: editor1이 visibility=private 포스트 발행, editor2가 editor1 팔로우
- **테스트 단계**:
  1. editor2로 `/feed` 진입
- **기대 결과**: editor1의 private 포스트 미표시
- **우선순위**: High

### TC-U035 팔로우 없을 때 빈 피드
- **전제조건**: 아무도 팔로우하지 않은 신규 editor
- **테스트 단계**:
  1. `/feed` 진입
- **기대 결과**: 빈 목록 또는 \"팔로우한 블로거가 없습니다\" 표시, 오류 없음
- **우선순위**: Medium

---

## 8. 검색

### TC-U036 키워드 검색 (Fulltext)
- **전제조건**: \"Flask 튜토리얼\" 제목 포스트 published
- **테스트 단계**:
  1. 검색창에 \"Flask\" 입력 (300ms 디바운스)
  2. 결과 확인
- **기대 결과**: \"Flask 튜토리얼\" 포스트 포함, 관련도 순 정렬
- **우선순위**: High

### TC-U037 작성자 필터
- **전제조건**: editor1 포스트 2개 이상, editor2 포스트 1개 이상
- **테스트 단계**:
  1. 검색 페이지 → 작성자 \"editor1\" 선택 또는 `?author=editor1`
- **기대 결과**: editor1 포스트만 표시, editor2 포스트 미표시
- **우선순위**: Medium

### TC-U038 카테고리 필터
- **전제조건**: 카테고리 \"기술\"에 포스트 2개 등록
- **테스트 단계**:
  1. 검색 페이지 → 카테고리 \"기술\" 선택
- **기대 결과**: \"기술\" 카테고리 포스트만 필터링
- **우선순위**: Medium

### TC-U039 태그 필터
- **전제조건**: 태그 \"#python\" 포스트 2개 등록
- **테스트 단계**:
  1. 검색 페이지 → 태그 \"#python\" 선택
- **기대 결과**: #python 태그 포스트만 표시
- **우선순위**: Medium

### TC-U040 복합 필터 (키워드 + 작성자 + 태그)
- **전제조건**: 다양한 포스트 등록
- **테스트 단계**:
  1. 키워드 \"Flask\" + 작성자 \"editor1\" + 태그 \"#python\" 동시 선택
- **기대 결과**: 세 조건 모두 만족하는 포스트만 표시 (AND 조건)
- **우선순위**: Medium

### TC-U041 검색 결과 없을 때 빈 상태
- **전제조건**: 없음
- **테스트 단계**:
  1. \"xyzzynotfound12345\" 검색
- **기대 결과**: \"검색 결과가 없습니다\" 표시, 오류 없음
- **우선순위**: Low

---

## 9. 온보딩 모달

### TC-U044 첫 로그인 editor 대상 온보딩 모달 노출
- **전제조건**: 신규 editor 계정 생성 (bio, blog_title 미설정 상태)
- **테스트 단계**:
  1. 신규 editor 계정으로 최초 로그인
  2. 화면 확인
- **기대 결과**: 온보딩 모달 표시 (\"블로그를 꾸며보세요\" 또는 유사 문구), 배경 스크롤 차단
- **우선순위**: Medium

### TC-U045 온보딩 모달 \"설정하기\" 버튼 동작
- **전제조건**: TC-U044 완료, 모달 표시 중
- **테스트 단계**:
  1. \"지금 설정하기\" (또는 유사) 버튼 클릭
- **기대 결과**: `/my-blog/settings` 페이지로 이동, 모달 닫힘
- **우선순위**: Medium

### TC-U046 온보딩 모달 \"나중에\" 버튼 동작
- **전제조건**: TC-U044 완료, 모달 표시 중
- **테스트 단계**:
  1. \"나중에\" (또는 닫기 X) 버튼 클릭
- **기대 결과**: 모달 닫힘, 현재 페이지 유지 (리다이렉트 없음)
- **우선순위**: Low

### TC-U047 bio 설정 완료 후 온보딩 모달 미노출
- **전제조건**: editor1 로그인, bio 설정 완료 상태
- **테스트 단계**:
  1. `PUT /api/auth/me` body: `{"bio": "안녕하세요"}` 호출
  2. 로그아웃 후 재로그인
- **기대 결과**: 온보딩 모달 미표시
- **우선순위**: Low

---

## 10. 비로그인 접근 제한

### TC-U048 `/my-blog/statistics` 비로그인 접근 차단
- **전제조건**: 비로그인 상태
- **테스트 단계**:
  1. `/my-blog/statistics` 직접 URL 진입
- **기대 결과**: 로그인 페이지로 리다이렉트 또는 접근 차단 (401/403 또는 FE 가드)
- **우선순위**: High

### TC-U049 `/my-blog/settings` 비로그인 접근 차단
- **전제조건**: 비로그인 상태
- **테스트 단계**:
  1. `/my-blog/settings` 직접 URL 진입
- **기대 결과**: 로그인 페이지로 리다이렉트 또는 접근 차단
- **우선순위**: High

### TC-U050 `/feed` 비로그인 접근 차단
- **전제조건**: 비로그인 상태
- **테스트 단계**:
  1. `/feed` 직접 URL 진입
- **기대 결과**: 로그인 페이지로 리다이렉트 또는 \"로그인이 필요합니다\" 안내, 오류 없음
- **우선순위**: Medium
