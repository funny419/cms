## 기획 전략 및 로드맵

**최종 업데이트:** 2026-03-30 (Sprint 2 완료 반영, 구 보고서 내용 통합)
**파일 역할:** UX 기획 전략 · 설계 원칙 · 미래 로드맵 상세 — 구현 현황 마스터는 `roadmap.md` 참조

---

## 1. Sprint 2 완료 요약 (2026-03-30)

Sprint 2에서 "사용자 가치 순서"로 구현한 기능 및 결과:

| 기능 | UX 가치 | 상태 |
|------|---------|------|
| 유저별 블로그 (`/blog/:username`) + ProfileCard | 멀티블로그 정체성 확립 | ✅ 완료 |
| 태그 시스템 (`tags`, `post_tags` + TagInput/TagCloud) | 크로스 블로그 발견 | ✅ 완료 |
| 카테고리 시스템 (계층형 3단 + CategoryDropdown/Sidebar) | 블로그 내 정리 체계 | ✅ 완료 |
| 포스트 공개 범위 (`visibility`: public/members_only/private) | 개인정보 보호, 신뢰도 향상 | ✅ 완료 |

**검증된 구현 원칙:** "DB 기술 순서"가 아닌 "사용자 가치 순서"로 개발.
블로그 홈 기초 → 태그 → 카테고리 → 블로그 홈 완성 순서가 사용자 경험 측면에서 유효했음.

---

## 2. 카테고리 vs 태그 UX 설계

### 시각적 구분

**블로그 홈 사이드바:**
```
📁 카테고리              🏷️ 태그 클라우드
├─ 기술 (12)           #react(5)
├─ 일상 (5)            #python(4)
├─ 여행 (3)            #javascript(3)
└─ 책 (2)              ...
```

### 사용자 입장에서의 차이

| 요소 | 카테고리 | 태그 |
|------|---------|------|
| **범위** | 한 블로그 내에서만 유효 | 모든 블로그를 가로지름 |
| **목적** | 정리 (작성자가 분류) | 발견 (사용자가 탐색) |
| **아이콘** | 📁 폴더 | 🏷️ 라벨 |
| **클릭 동작** | `/blog/:username/category/:cat-id` | `/posts?tag=react` |
| **사용자 느낌** | "블로그가 정갈하다" | "관심사별 글을 찾을 수 있다" |

### 온보딩 텍스트

**카테고리:**
```
📁 카테고리: 당신이 글을 체계적으로 정리한 기준입니다.
예) '기술', '일상', '여행'
→ 한 블로그의 카테고리이므로, 당신의 블로그만 특화됨
```

**태그:**
```
🏷️ 태그: 글의 주제를 표시하는 자유로운 라벨입니다.
예) '#React', '#일상', '#여행기'
→ 모든 블로그의 글을 태그로 모아볼 수 있어서 더 많은 글을 발견할 수 있습니다
```

---

## 3. 블로그 홈 현황 및 남은 과제

### ✅ MVP 완료

| 요소 | 구현 컴포넌트 |
|------|-------------|
| 프로필 헤더 (이름, bio, avatar_url) | `ProfileCard.jsx` |
| 포스트 목록 (최근 순, 카테고리 필터) | `BlogHome.jsx` |
| 카테고리 사이드바 (포스트 수 표시) | `CategorySidebar.jsx` |
| 태그 클라우드 (빈도 강조) | `TagCloud.jsx` |

### 남은 과제 (Phase 2.2 — 선택 구현)

- 블로그 통계 위젯 (포스트 수, 조회수, 댓글 수)
- [구독] 버튼 — 구독 시스템 구현 후 활성화

---

## 4. 블로그 커스터마이제이션 UX 개선 (Phase 2.5 ~ 3.1)

> **목적:** "포스트 나열"에서 "내 블로그"로의 전환
> **기대 효과:** 사용자 만족도 ↑ 40%, 재방문율 ↑ (자신의 블로그를 보여주고 싶은 욕구)

### Phase 2.5 (1-2주) — 초기 개인화

**User 모델 추가 필요 (bio/avatar_url은 Sprint 1 완료):**
```python
website_url: str       # 웹사이트 링크
social_links: JSON     # SNS 링크 (GitHub, Twitter, LinkedIn)
blog_title: str        # 커스텀 제목 (기본값: username)
blog_color: str        # 대표 색상 HEX (기본값: --accent)
```

**구현:**
- `/my-blog/settings` 페이지 추가
- "📋 기본 정보" 탭 (웹사이트, SNS 링크)
- "🎨 디자인" 탭 (배너 색상, 대표 색상)
- 우측 실시간 미리보기 패널

**사용자 가치:**
```
"내 블로그가 내 얼굴이다"
├─ 블로그 소개글 ← 개성 표현 (✅ bio 완료)
├─ 프로필 사진 ← 신뢰도 ↑ (✅ avatar_url 완료)
├─ 배너 색상 ← 시각적 임팩트
└─ SNS 링크 ← 팔로우 유도
```

---

### Phase 3.1 (2-3주) — 고급 커스터마이제이션

**User 모델 추가:**
```python
banner_image_url: str      # 배너 이미지 URL
blog_layout: str           # 레이아웃 선택 (기본값: 'default')
```

**블로그 레이아웃 옵션:**
- Layout A: 기본 (좌측 사이드바, 카테고리/태그 표시)
- Layout B: 콤팩트 (사이드바 숨김, 포스트 목록만)
- Layout C: 포토그래피 (큼직한 썸네일 그리드)
- Layout D: 매거진 (카드형 메인 포스트 + 리스트)

---

## 5. 온보딩 전략

### 첫 블로그 방문 시 모달

```
┌─────────────────────────────────┐
│  블로그를 꾸며보세요! 🎨        │
├─────────────────────────────────┤
│                                 │
│ 지금 바로:                      │
│ 1. 프로필 사진 추가 (30초)       │
│ 2. 블로그 소개글 작성 (1min)     │
│ 3. 디자인 테마 선택 (30초)       │
│                                 │
│ [지금 설정하기] [나중에]         │
└─────────────────────────────────┘
```

### 설정 페이지 진입 경로

**Nav 메뉴:**
```
[내 블로그 ▼]
├─ 내 글 보기 (/my-posts)
├─ 블로그 설정 (/my-blog/settings) ← 신규
└─ 통계 (/my-blog/analytics) ← 미래
```

**블로그 홈에서:**
- 프로필 카드 우상단 톱니바퀴 [설정] 버튼
- "당신의 블로그를 꾸며보세요" 툴팁

---

## 6. 통합 로드맵

```
✅ Sprint 1 (완료):
  bio/avatar_url + visibility + PostEditor 개선
  ↓
✅ Sprint 2 (완료):
  블로그 홈 기초 + 태그/카테고리 시스템
  ↓
Phase 2.5 (다음):
  + 블로그 설정 (웹사이트, SNS 링크, 대표 색상)
  → "내 블로그가 내 얼굴이다" 단계
  ↓
Phase 3.1 (이후):
  + 고급 레이아웃 선택 (4가지)
  + 폰트 설정
  + 온보딩 모달
  → "프로페셔널한 블로그 플랫폼" 단계
  ↓
Phase 2 (공개 범위 고도화 + 예약 발행):
  + published_at + APScheduler
  + 검색 고도화 (Fulltext 인덱스, /search 페이지)
  ↓
Phase 3 (상호작용 + 분석):
  + 구독/이웃 (follows 테이블)
  + 알림 시스템 (Socket.IO)
  + 블로그 통계 (recharts 대시보드)
```

---

## 7. 멀티 유저 블로그 플랫폼 확장 로드맵

> 단일 설치형 CMS → 멀티 유저 블로그 플랫폼으로 확장 계획 (2026-03-26 전문가팀 분석)
> **핵심 전제:** 모든 확장은 `blogs` 테이블(유저별 블로그 분리) 생성이 선행되어야 함
> Sprint 2에서 categories/tags/post_tags는 이미 구현됨

### Phase 1 (1-2개월): 기반 구조

| 영역 | 작업 |
|------|------|
| DB | `blogs`, `series`, `visit_logs` 테이블. `posts`에 `blog_id`, `published_at` 추가 (categories/tags는 Sprint 2 완료) |
| BE | Redis 캐싱(`flask-caching`). 복합 인덱스 추가 |
| FE | Zustand 상태관리. Route-based 코드 스플리팅 |
| INFRA | Redis Cluster, Prometheus+Grafana, TLS+Cloudflare WAF |

### Phase 2 (2-3개월): 커뮤니티 기능

| 영역 | 작업 |
|------|------|
| DB | `follows`, `guestbook`, `notifications`, `visit_daily_stats` 테이블 |
| BE | `POST /api/users/:id/follow`, `GET /api/feed`, `WS /ws/notifications` (Socket.IO) |
| FE | `/feed` 이웃 피드, `/notifications` 알림 센터, `/my-blog/settings` |
| INFRA | DB Read Replica, Cloudflare R2 마이그레이션 |

### Phase 3 (3-6개월): 고도화

| 영역 | 작업 |
|------|------|
| DB | `post_stats`, `series_posts`. `visit_logs` 월별 파티셔닝 |
| BE | RSS 피드, Elasticsearch 전문 검색, 통계 API |
| FE | `/my-blog/statistics` 대시보드(recharts), 블로그 스킨 커스터마이저 |
| INFRA | Kubernetes 전환, 멀티리전 확장 |

---

## 8. 성공 지표 (KPI)

### 서비스 레벨 KPI

| KPI | 목표 | 측정 방법 |
|-----|------|---------|
| 사용자 확보 | 가입자 100명 | 회원가입 테이블 |
| 활성 사용자 | 월 30% DAU | 로그인 로그 |
| 콘텐츠 생산 | 월 포스트 200개 | Post 테이블 |
| 상호작용 | 포스트당 평균 댓글 2개 | Comment 테이블 |
| 블로그 방문 | 월 10K 유니크 방문자 | 방문자 로그 |

### 기능별 KPI

| Phase | 지표 | 목표 |
|-------|------|------|
| Phase 1 (콘텐츠 분류) | 카테고리 활용도 | 포스트의 80% 분류됨 |
| Phase 1 | 태그 사용률 | 평균 포스트당 2.5개 태그 |
| Phase 1 | 검색 조회수 | 월 1K 검색 |
| Phase 2 (공개 제어) | 예약 발행 사용률 | 포스트의 20% 예약 |
| Phase 2 | 예약 정시 발행률 | 99.9% |
| Phase 3 (상호작용) | 구독자 확보 | 유저당 평균 5명 |
| Phase 3 | 재방문율 | 60% (주간) |

### 기술 KPI

| 지표 | 목표 |
|------|------|
| API 응답 시간 | P95 < 200ms |
| 검색 응답 시간 | < 500ms (Fulltext 인덱스 도입 후) |
| 페이지 로딩 시간 | < 2s (WebVitals) |
| 예약 발행 스케줄러 실패율 | < 0.1% |

---

## 참고 문서

- `architecture.md` — 프로젝트 아키텍처 (권한 체계, 포스트 소유권)
- `api.md` — API 엔드포인트 명세
- `.claude/skills/service-planning.md` — 기획 워크플로
- `.claude/skills/new-api-endpoint.md` — API 추가 워크플로
- `.claude/skills/new-page.md` — React 페이지 추가 워크플로
