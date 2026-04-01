# Sprint 3 QA 테스트 케이스 — 인덱스

**작성일:** 2026-03-31
**작성자:** QA
**대상 브랜치:** dev
**환경:** http://localhost:5173 (FE), http://localhost:5000 (BE API)
**총 TC:** 76개 (사용자 50 + 어드민 17 + 통합 9)

---

## TC 파일 구성

| 파일 | 대상 | TC 수 | TC 범위 |
|------|------|-------|---------|
| [tc_user.md](tc_user.md) | editor / visitor (비로그인) | 50개 | TC-U001 ~ TC-U050 |
| [tc_admin.md](tc_admin.md) | admin | 17개 | TC-A001 ~ TC-A017 |
| [tc_integration.md](tc_integration.md) | 크로스 롤 통합 시나리오 | 9개 | TC-I001 ~ TC-I009 |

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

---

## 이슈 추적

| BUG | 심각도 | 상태 | 관련 TC |
|-----|--------|------|---------|
| BUG-1: blog_layout magazine/photo 허용값 누락 | HIGH | 완료 (commit 35a84de, QA PASS 2026-04-01) | TC-U023, TC-U024, TC-I005 |
| BUG-2: RSS base_url 하드코딩 | MEDIUM | 완료 (commit 2c9dc2d, QA PASS 2026-04-01) | TC-I008 |
| BUG-3: 포스트 다중 시리즈 시 500 | MEDIUM | 완료 (commit 2c9dc2d, QA PASS 2026-04-01) | TC-U042 |
| BUG-4: VisitLog 예외 시 view_count 롤백 | LOW | 완료 (commit 6baed90) | TC-U012 |
| BUG-5: VisitLog DB UNIQUE 미구현 | LOW | 의도적 결정 | TC-U013, TC-I007 |
| BUG-6: 시리즈 라우트 미등록 (`/blog/:username/series/:slug` App.jsx 누락) | MEDIUM | 완료 (commit 176cef6, QA PASS 2026-04-01) | TC-U004 |
