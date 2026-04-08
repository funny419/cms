# Sprint 3 QA 테스트 케이스 — 인덱스

**작성일:** 2026-03-31
**작성자:** QA
**대상 브랜치:** dev
**환경:** http://localhost:5173 (FE), http://localhost:5000 (BE API)
**총 TC:** 92개 (사용자 50 + 어드민 20 + 통합 9 + 위저드 13)

---

## TC 파일 구성

| 파일 | 대상 | TC 수 | TC 범위 |
|------|------|-------|---------|
| [tc_user.md](tc_user.md) | editor / visitor (비로그인) | 50개 | TC-U001 ~ TC-U050 |
| [tc_admin.md](tc_admin.md) | admin | 20개 | TC-A001 ~ TC-A020 |
| [tc_integration.md](tc_integration.md) | 크로스 롤 통합 시나리오 | 9개 | TC-I001 ~ TC-I009 |
| [tc_wizard.md](tc_wizard.md) | Setup Wizard 초기 설치 플로우 | 13개 | TC-W001 ~ TC-W013 |

---

## TC 번호 매핑 (구 tc_sprint3.md → 신규)

| 구 번호 | 신 번호 | 기능 |
|---------|---------|------|
| TC-001 | TC-U001 | 시리즈 생성 — PostEditor |
| TC-002 | TC-U002 | 시리즈에 두 번째 포스트 추가 |
| TC-003 | TC-U003 | SeriesNav — 이전/다음 탐색 |
| TC-004 | TC-U004 | BlogHome 시리즈 섹션 |
| TC-005 | TC-U005 | 시리즈 권한 — 타인 편집 불가 |
| TC-006 | TC-U006 | 시리즈 삭제 후 SeriesNav 제거 |
| TC-007 | TC-U007 | 통계 대시보드 진입 |
| TC-008 | TC-U008 | period 필터 전환 |
| TC-009 | TC-U009 | 타인의 통계 직접 접근 차단 |
| TC-010 | TC-A013 | Admin 전체 유저 통계 조회 |
| TC-011 | TC-U010 | 포스트 없을 때 통계 빈 상태 |
| TC-012 | TC-U011 | Top 10 포스트 목록 |
| TC-013 | TC-U012 | 포스트 조회 시 방문 로그 기록 |
| TC-014 | TC-U013 | 동일 IP + 당일 재방문 중복 방지 |
| TC-015 | TC-U014 | 편집 페이지 진입 시 방문 로그 미기록 |
| TC-016 | TC-U015 | 비로그인 방문자 로그 기록 |
| TC-017 | TC-U016 | Twitter 공유 링크 정상 생성 |
| TC-018 | TC-U017 | Facebook 공유 링크 정상 생성 |
| TC-019 | TC-U018 | LinkedIn 공유 링크 정상 생성 |
| TC-020 | TC-U019 | 링크 복사 기능 + 2초 피드백 |
| TC-021 | TC-U020 | 한글 제목 포스트 공유 URL 인코딩 |
| TC-022 | TC-U023 | 레이아웃 D — 매거진 적용 |
| TC-023 | TC-U022 | 레이아웃 B — 콤팩트 적용 |
| TC-024 | TC-U024 | 레이아웃 C — 포토 적용 |
| TC-025 | TC-U021 | 레이아웃 A — 기본 적용 |
| TC-026 | TC-U025 | 레이아웃 설정값 유지 (새로고침) |
| TC-027 | TC-U026 | 블로그 제목 설정 |
| TC-028 | TC-U027 | 블로그 대표 색상 설정 |
| TC-029 | TC-U029 | SNS 링크 설정 및 ProfileCard 반영 |
| TC-030 | TC-U028 | blog_color 잘못된 형식 입력 시 오류 |
| TC-031 | TC-U030 | 웹사이트 URL 설정 |
| TC-032 | TC-U031 | 팔로우 버튼 — 팔로우/언팔로우 토글 |
| TC-033 | TC-U032 | 본인 팔로우 불가 |
| TC-034 | TC-U033 | 이웃 피드 포스트 노출 |
| TC-035 | TC-U034 | 피드 — private 포스트 미노출 |
| TC-036 | TC-U035 | 팔로우 없을 때 빈 피드 |
| TC-037 | TC-U036 | 키워드 검색 (Fulltext) |
| TC-038 | TC-U037 | 작성자 필터 |
| TC-039 | TC-U038 | 카테고리 필터 |
| TC-040 | TC-U039 | 태그 필터 |
| TC-041 | TC-U040 | 키워드 + 작성자 + 태그 복합 필터 |
| TC-042 | TC-U041 | 검색 결과 없을 때 빈 상태 |
| — | TC-U042 | BUG-3 재현 — 포스트 다중 시리즈 추가 시 500 오류 |
| — | TC-U043 | members_only 포스트 비로그인 접근 차단 (401/403) |
| — | TC-U044 | 첫 로그인 editor 온보딩 모달 노출 |
| — | TC-U045 | 온보딩 모달 "설정하기" 버튼 → `/my-blog/settings` 이동 |
| — | TC-U046 | 온보딩 모달 "나중에" 버튼 → 모달 닫힘, 리다이렉트 없음 |
| — | TC-U047 | bio 설정 완료 후 온보딩 모달 미노출 |
| — | TC-U048 | `/my-blog/statistics` 비로그인 접근 차단 |
| — | TC-U049 | `/my-blog/settings` 비로그인 접근 차단 |
| — | TC-U050 | `/feed` 비로그인 접근 차단 |
| TC-W001 | TC-W001 | Wizard 완료 상태에서 `/wizard` 접속 → `/login` 리다이렉트 |
| TC-W002 | TC-W002 | DB 연결 테스트 — 정상 연결 성공 |
| TC-W003 | TC-W003 | DB 연결 테스트 — 잘못된 비밀번호 → auth_failed |
| TC-W004 | TC-W004 | DB 연결 테스트 — 존재하지 않는 DB명 → db_not_found |
| TC-W005 | TC-W005 | DB 연결 테스트 — 연결 불가 호스트 → host_unreachable |
| TC-W006 | TC-W006 | .env 저장 후 재시작 안내 UI 표시 |
| TC-W007 | TC-W007 | DB_ENV_WRITTEN=true 상태 env 재요청 → already_written 200 |
| TC-W008 | TC-W008 | 마이그레이션 자동 실행 — 성공 200 반환 |
| TC-W009 | TC-W009 | Setup 완료 — 관리자 계정 생성 성공 201 |
| TC-W010 | TC-W010 | Setup 완료 후 재요청 → 409 |
| TC-W011 | TC-W011 | 비밀번호 8자 미만 Setup 요청 → 400 |
| TC-W012 | TC-W012 | Docker 재시작 후 FE step 복원 (localStorage) |
| — | TC-A018 | MIME 위장 파일 업로드 차단 (보안 #4, 2026-04-08 추가) |
| — | TC-A019 | 파일 크기 제한 초과 업로드 차단 (보안 #8, 2026-04-08 추가) |
| — | TC-A020 | Rate Limiting 로그인 브루트포스 차단 (보안 #5, 2026-04-08 추가) |
| — | TC-W013 | Wizard 마이그레이션 재실행 차단 (보안 #3, 2026-04-08 추가) |

---

## 이슈 추적

| BUG | 심각도 | 상태 | 관련 TC |
|-----|--------|------|---------|
| BUG-1: blog_layout magazine/photo 허용값 누락 | HIGH | 완료 (commit 35a84de, QA PASS 2026-04-01) | TC-U023, TC-U024, TC-I005 |
| BUG-2: RSS base_url 하드코딩 | MEDIUM | 완료 (commit 2c9dc2d, QA PASS 2026-04-01) | TC-I008 |
| BUG-3: 포스트 다중 시리즈 시 500 | MEDIUM | 완료 (commit 2c9dc2d, QA PASS 2026-04-01) | TC-U042 |
| BUG-4: VisitLog 예외 시 view_count 롤백 | LOW | 완료 (commit 6baed90, QA PASS 2026-04-01) | TC-U012 |
| BUG-5: VisitLog DB UNIQUE 미구현 | LOW | 의도적 결정 | TC-U013, TC-I007 |
| BUG-6: 시리즈 라우트 미등록 (`/blog/:username/series/:slug` App.jsx 누락) | MEDIUM | 완료 (commit 176cef6, QA PASS 2026-04-01) | TC-U004 |
| BUG-7: Flask-Limiter 429 응답 HTML 반환 — `{"success":false,"error":"Too Many Requests"}` JSON 형식으로 수정 필요. E2E 병렬 워커 rate limit 조기 발동 문제도 연관 | HIGH | 미수정 | TC-A020 |
