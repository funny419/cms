# CMS 프론트엔드 아키텍처 확장 분석 보고서
**작성일**: 2026-03-26
**담당**: 시니어 프론트엔드 개발자

---

## Executive Summary

현재 CMS 프론트엔드는 **단순하고 효율적인 구조**로, 기본 블로그 기능을 잘 구현하고 있습니다. 그러나 **대형 블로그 플랫폼 수준의 확장**(유저별 블로그, 카테고리, 통계, 알림 등)에는 다음이 필요합니다:

1. **상태관리 고도화**: Zustand로 API 응답 캐싱 및 전역 상태 중앙화
2. **라우팅 재구조화**: 동적 라우팅 지원 (예: `/blog/:username`)
3. **신규 페이지/컴포넌트**: 블로거 프로필, 피드, 통계 등
4. **성능 최적화**: 코드 스플리팅, 가상화, 이미지 최적화
5. **디자인 시스템 확장**: 모듈식 컴포넌트 라이브러리

---

## 1. 현재 FE 구조 분석

### 1.1 강점 (Strengths)

| 항목 | 설명 |
|------|------|
| **깔끔한 라우팅** | React Router 7.x로 간결한 라우트 정의 |
| **API 추상화** | `frontend/src/api/` 모듈화로 서버 독립성 |
| **Context 활용** | 테마/스킨 전역 상태 간단하게 구현 |
| **무한 스크롤** | 재사용 가능한 `useInfiniteScroll` 훅 |
| **권한 기반 UI** | role 기반 페이지/메뉴 분기 명확 |
| **다중 포맷 지원** | Quill/Markdown 에디터 유연한 선택 |
| **CSS Variables** | 테마/스킨 전환 빠르고 효율적 |

### 1.2 약점 (Weaknesses)

| 항목 | 문제점 |
|------|--------|
| **상태관리 분산** | localStorage + Context + 컴포넌트 로컬 상태 혼재 |
| **API 캐싱 부재** | 같은 데이터를 여러 번 요청 (예: 사용자 프로필) |
| **페이지 간 데이터 공유 제한** | Props/콜백으로 인한 prop drilling |
| **성능 모니터링 부재** | 렌더링 최적화/코드 스플리팅 미적용 |
| **타입 안전성 부재** | TypeScript 미사용 → 런타임 에러 가능 |
| **에러 처리 미흡** | 전역 Error Boundary 없음 |
| **테스트 부재** | 유닛/통합 테스트 미구현 |
| **동적 라우팅 한계** | `/blog/:username` 등 유연한 라우팅 어려움 |

### 1.3 아키텍처 성숙도

**현재 수준**: **MVP ~ Phase 2** (기본 기능 완성, 확장 준비 단계)

- 단순 블로그 (5~10개 페이지) 수준
- 중규모 프로젝트 (50개+ 페이지) 전환 시 리팩토링 필요

---

## 2. 대형 블로그 플랫폼 핵심 기능 분석 (FE 관점)

대형 블로그 플랫폼의 주요 FE 요구사항:

### 2.1 주요 기능 목록

#### A. 블로거 중심 기능

| 기능 | 설명 | FE 구현 복잡도 |
|------|------|---|
| **유저별 블로그 홈** | `/blog/:username` - 블로거 프로필 + 포스트 목록 | ⭐⭐⭐ |
| **카테고리 사이드바** | 트리 구조 카테고리 + 포스트 필터 | ⭐⭐⭐ |
| **블로그 스킨 커스터마이저** | 유저별 블로그 배경/폰트/레이아웃 선택 | ⭐⭐⭐⭐ |
| **프로필 뱃지/통계** | 팔로워 수, 총 포스트 수, 가입일 | ⭐⭐ |
| **포스트 시리즈** | 연관 포스트 목록 (시리즈 > 타이틀) | ⭐⭐ |

#### B. 커뮤니티 기능

| 기능 | 설명 | FE 구현 복잡도 |
|------|------|---|
| **이웃 블로그 목록** | 사용자가 팔로우한 블로거 목록 (무한스크롤) | ⭐⭐ |
| **메인 피드** | 이웃의 최신 포스트 (타임라인) | ⭐⭐⭐ |
| **알림 센터** | 팔로우, 댓글, 추천 등의 알림 | ⭐⭐⭐⭐ |
| **게스트북** | 블로거 방명록 (댓글과 유사한 계층 구조) | ⭐⭐ |

#### C. 블로거 분석 기능

| 기능 | 설명 | FE 구현 복잡도 |
|------|------|---|
| **통계 대시보드** | 일일/월별 방문자, 포스트 성과 그래프 | ⭐⭐⭐⭐ |
| **포스트 성과** | 포스트별 조회수, 추천수, 댓글 수 | ⭐⭐ |
| **독자 분석** | 독자 연령, 지역, 시간대 (차트 필요) | ⭐⭐⭐⭐⭐ |

#### D. 검색 및 검색결과

| 기능 | 설명 | FE 구현 복잡도 |
|------|------|---|
| **검색 결과 페이지** | `/search?q=키워드` - 포스트/블로거/해시태그 혼합 | ⭐⭐⭐ |
| **자동완성** | 입력 중 검색어 제안 (실시간 API) | ⭐⭐⭐ |

---

## 3. 신규 페이지 설계

### 3.1 라우팅 구조 (전체)

```javascript
// App.jsx - 신규 라우트 추가
const router = createBrowserRouter([
  // 기존
  { path: '/', ... },
  { path: '/login', ... },
  { path: '/register', ... },
  { path: '/posts', ... },
  { path: '/posts/:id', ... },
  { path: '/posts/new', ... },
  { path: '/posts/:id/edit', ... },
  { path: '/my-posts', ... },
  { path: '/profile', ... },
  { path: '/admin/*', ... },

  // 신규: 블로거 중심
  { path: '/blog/:username', component: BlogHome },                 // 유저별 블로그
  { path: '/blog/:username/category/:categoryId', component: CategoryPosts },
  { path: '/blog/:username/series/:seriesId', component: SeriesPosts },
  { path: '/blog/:username/guestbook', component: GuestBook },
  { path: '/blog/:username/statistics', component: BlogStatistics },

  // 신규: 커뮤니티
  { path: '/following', component: FollowingList },                 // 이웃 블로그
  { path: '/feed', component: MainFeed },                          // 이웃 피드
  { path: '/notifications', component: NotificationCenter },        // 알림
  { path: '/search', component: SearchResults },                    // 검색 결과

  // 신규: 개인 블로거 대시보드
  { path: '/my-blog/settings', component: BlogSettings },          // 내 블로그 설정
  { path: '/my-blog/statistics', component: MyBlogStatistics },    // 내 블로그 통계
  { path: '/my-blog/categories', component: CategoryManager },      // 카테고리 관리

  { path: '*', component: NotFound },
]);
```

### 3.2 신규 페이지 상세 설계

#### A. `/blog/:username` (블로거 홈)

**목적**: 특정 블로거의 공개 블로그 페이지

**구조**:
```
┌─ BlogHeader
│  ├─ 블로거 프로필 (아바타, 이름, 팔로워 수)
│  ├─ 팔로우/언팔로우 버튼
│  ├─ 블로거 소개 텍스트
│  └─ 블로거 통계 배지 (총 포스트 수, 가입일, 평균 조회수)
├─ BlogLayout (사이드바 + 메인)
│  ├─ Sidebar
│  │  ├─ 카테고리 트리
│  │  ├─ 최근 포스트 위젯
│  │  └─ 인기 포스트 위젯
│  └─ MainContent
│     ├─ BlogSettings (옵션, 라디오 버튼)
│     │  ├─ 정렬순서: 최신/인기/댓글수
│     │  └─ 보기: 목록/카드/타일
│     └─ PostList (검색 포함)
└─ BlogFooter
```

**데이터 흐름**:
```javascript
// BlogHome.jsx
const { username } = useParams();
const [blogger, setBlogger] = useState(null);
const [categories, setCategories] = useState([]);

useEffect(() => {
  // 1. 블로거 정보 조회: GET /api/users/:username
  getBloggerProfile(username).then(res => setBlogger(res.data));

  // 2. 블로거의 카테고리: GET /api/users/:username/categories
  getBloggerCategories(username).then(res => setCategories(res.data));
}, [username]);

// 3. 포스트 목록 (카테고리 선택 시): GET /api/posts?author=username&category=catId
```

**신규 API 필요**:
- `GET /api/users/:username` - 블로거 프로필 + 통계
- `GET /api/users/:username/categories` - 블로거 카테고리 목록
- `GET /api/posts?author=username&category=categoryId` - 필터된 포스트

---

#### B. `/my-blog/settings` (내 블로그 설정)

**목적**: 블로거가 자신의 블로그 외관 커스터마이징

**구조**:
```
┌─ SettingsNav (탭)
│  ├─ 기본 설정
│  ├─ 스킨/레이아웃
│  ├─ 카테고리
│  └─ 프라이버시
├─ SettingsPanel
│  ├─ [기본 설정 탭]
│  │  ├─ 블로그 이름 변경
│  │  ├─ 블로그 소개 텍스트
│  │  └─ 배경 이미지 업로드
│  │
│  ├─ [스킨/레이아웃 탭]
│  │  ├─ 스킨 프리셋 (현재 4종)
│  │  ├─ 헤더 레이아웃 선택 (기본/와이드/좌측)
│  │  ├─ 사이드바 위젯 선택 (활성화/비활성화)
│  │  └─ 커스텀 CSS (고급 사용자)
│  │
│  └─ [카테고리 탭]
│     ├─ 카테고리 목록 (드래그 & 드롭 정렬)
│     ├─ 카테고리 추가/수정/삭제
│     └─ 부모 카테고리 지정 (뎁스 2 지원)
└─ PreviewPanel (우측, 실시간 미리보기)
```

**상태관리**:
```javascript
// BlogSettingsContext.jsx
const [blogSettings, setBlogSettings] = useState({
  blog_name: '',
  blog_intro: '',
  background_image_url: '',
  skin: 'notion',          // 기존 스킨 확장
  header_layout: 'default', // 신규
  sidebar_widgets: ['recent', 'popular', 'categories'], // 신규
  custom_css: '', // 신규
  privacy: 'public' // 신규: public/private/password
});

// 변경 감지: 우측 미리보기 실시간 업데이트
// 저장: PUT /api/users/me/blog-settings
```

---

#### C. `/feed` (메인 피드 - 이웃 새 글)

**목적**: 팔로우한 블로거들의 최신 포스트 타임라인

**구조**:
```
┌─ FeedNav (필터)
│  ├─ 전체 / 팔로잉만 / 카테고리별
│  └─ 정렬: 최신순 / 인기순 / 댓글순
├─ FeedList (무한 스크롤)
│  └─ FeedItem (각 포스트)
│     ├─ 블로거 헤더 (아바타, 이름, 팔로우 버튼)
│     ├─ 포스트 제목 + 발행일
│     ├─ 포스트 요약 (excerpt, 이미지 썸네일)
│     ├─ 상호작용 바 (조회수, 추천, 댓글 수)
│     └─ 바로가기 버튼
└─ Sidebar
   ├─ 추천 블로거 (팔로우할 블로거 제안)
   └─ 인기 해시태그
```

**데이터 흐름**:
```javascript
// MainFeed.jsx
const [filters, setFilters] = useState({ category: 'all', sort: 'latest' });

// 무한 스크롤: GET /api/posts/feed?page=1&category=all&sort=latest&following=true
const { items: feedPosts, ...scroll } = useInfiniteScroll(
  (page) => getFeed(token, page, filters),
  [token, filters]
);
```

**신규 API**:
- `GET /api/posts/feed?page=1&category=all&sort=latest&following=true` - 피드

---

#### D. `/notifications` (알림 센터)

**목적**: 팔로우, 댓글, 추천, 게스트북 등의 알림 통합

**구조**:
```
┌─ NotificationNav (탭)
│  ├─ 전체
│  ├─ 팔로우
│  ├─ 댓글
│  ├─ 추천
│  └─ 게스트북
├─ NotificationList (무한 스크롤)
│  └─ NotificationItem
│     ├─ 아이콘 (팔로우/댓글/추천 등)
│     ├─ 설명 (누가 뭘 했는지)
│     ├─ 타임스탬프 (5시간 전)
│     ├─ 읽음/미읽 상태
│     └─ 클릭 시 해당 페이지로 이동
└─ 우측 상단 벨 아이콘
   ├─ 미읽 알림 배지 (숫자)
   └─ 최근 5개 미리보기 팝오버
```

**데이터 흐름**:
```javascript
// NotificationCenter.jsx
const [notifications, setNotifications] = useState([]);
const [unreadCount, setUnreadCount] = useState(0);

useEffect(() => {
  // 1. 알림 목록: GET /api/notifications?page=1
  listNotifications(token, page).then(res => setNotifications(res.data));

  // 2. 미읽 개수: GET /api/notifications/unread-count
  getUnreadCount(token).then(res => setUnreadCount(res.data.count));

  // 3. 실시간 알림 (WebSocket 또는 polling)
}, [page]);

// 알림 읽음 표시: PUT /api/notifications/:id/read
```

**신규 API**:
- `GET /api/notifications?page=1` - 알림 목록
- `GET /api/notifications/unread-count` - 미읽 개수
- `PUT /api/notifications/:id/read` - 읽음 표시
- WebSocket: `/ws/notifications` (실시간, 선택사항)

---

#### E. `/search` (검색 결과)

**목적**: 포스트, 블로거, 해시태그 통합 검색

**구조**:
```
┌─ SearchHeader
│  ├─ 검색 입력 + 자동완성
│  └─ 검색 필터 (포스트/블로거/태그)
├─ SearchTabs (결과 분류)
│  ├─ 포스트 (n개)
│  ├─ 블로거 (n개)
│  └─ 태그 (n개)
└─ SearchResults (해당 탭 내용)
   ├─ ResultList (무한 스크롤)
   └─ NoResults (결과 없을 시)
```

**데이터 흐름**:
```javascript
// SearchResults.jsx
const { q } = useSearchParams();
const [tab, setTab] = useState('posts'); // posts | bloggers | tags

// API 호출:
// GET /api/posts/search?q=keyword (포스트)
// GET /api/users/search?q=keyword (블로거)
// GET /api/tags/search?q=keyword (태그)
```

**신규 API**:
- `GET /api/posts/search?q=keyword&page=1` - 포스트 검색
- `GET /api/users/search?q=keyword` - 블로거 검색
- `GET /api/tags/search?q=keyword` - 태그 검색
- `GET /api/search/autocomplete?q=keyword` - 자동완성

---

#### F. `/blog/:username/statistics` (블로그 통계, 공개)

**목적**: 블로거가 자신의 블로그 성과를 공개 프로필에 표시

**구조** (읽기 전용):
```
┌─ StatisticsHeader
│  ├─ 총 포스트 수
│  ├─ 총 조회수
│  └─ 평균 포스트당 조회수
├─ StatisticsCharts
│  ├─ 월별 포스트 수 (막대 차트)
│  ├─ 월별 총 조회수 (선 차트)
│  └─ 포스트별 성과 (테이블)
└─ TopPosts (상위 5개 포스트)
```

---

#### G. `/my-blog/statistics` (내 블로그 통계, 개인용)

**목적**: 블로거 대시보드 - 상세한 통계 및 분석

**구조** (상호작용 + 필터 가능):
```
┌─ StatisticsNav
│  ├─ 일간/월간/년간 선택
│  ├─ 기간 선택 (달력)
│  └─ 카테고리 필터
├─ StatisticsOverview (4개 KPI 카드)
│  ├─ 총 조회수
│  ├─ 평균 조회수/포스트
│  ├─ 총 댓글 수
│  └─ 총 추천 수
├─ StatisticsCharts
│  ├─ 일일 방문자 수 (선 차트, 기간별 집계)
│  ├─ 포스트별 성과 (테이블, 정렬 가능)
│  └─ 시간대별 방문자 (히트맵)
└─ AdvancedAnalytics (고급, 선택사항)
   ├─ 독자 연령 분포
   ├─ 지역별 방문자
   └─ 추천 기기 (모바일/데스크톱)
```

**라이브러리**: `recharts` (차트) 또는 `react-chartjs-2` (Chart.js)

---

### 3.3 신규 페이지 구현 우선순위

| 우선순위 | 페이지 | 복잡도 | 기간 | 의존 기능 |
|---------|--------|--------|------|---------|
| **P0** | `/blog/:username` | ⭐⭐⭐ | 1-2주 | API: 사용자 프로필, 카테고리 |
| **P0** | `/feed` | ⭐⭐⭐ | 1-2주 | API: 팔로우 시스템, 피드 |
| **P1** | `/search` | ⭐⭐⭐ | 1주 | API: 검색 엔드포인트 |
| **P1** | `/my-blog/settings` | ⭐⭐⭐⭐ | 2-3주 | 블로그 설정 저장소 확장 |
| **P1** | `/notifications` | ⭐⭐⭐⭐ | 1-2주 | API: 알림 시스템 + WebSocket |
| **P2** | `/my-blog/statistics` | ⭐⭐⭐⭐ | 2-3주 | 차트 라이브러리, 통계 API |
| **P3** | `/blog/:username/statistics` | ⭐⭐ | 1주 | 동일 API |
| **P3** | `/blog/:username/guestbook` | ⭐⭐ | 1주 | 게스트북 댓글 API |

---

## 4. 신규 컴포넌트 설계

### 4.1 재사용 컴포넌트 라이브러리

기존 컴포넌트를 모듈화하여 다양한 페이지에서 재사용:

#### A. 레이아웃 컴포넌트

```javascript
// components/layouts/
├─ TwoColumnLayout.jsx       // 사이드바 + 메인 (블로그, 댓글)
├─ AdminLayout.jsx           // 어드민용 레이아웃
├─ CenterLayout.jsx          // 중앙 정렬 (로그인)
└─ FullWidthLayout.jsx       // 전체 폭 (검색, 피드)
```

#### B. 카드/아이템 컴포넌트

```javascript
// components/cards/
├─ PostCard.jsx              // 포스트 미니 카드 (제목+요약+이미지)
├─ BloggerCard.jsx           // 블로거 프로필 카드 (아바타+이름+팔로우)
├─ NotificationCard.jsx      // 알림 카드
├─ StatisticsCard.jsx        // KPI 카드 (숫자+제목)
└─ CategoryCard.jsx          // 카테고리 카드 (트리 또는 태그)
```

#### C. 폼/입력 컴포넌트

```javascript
// components/forms/
├─ SearchInput.jsx           // 검색 입력 + 자동완성
├─ DateRangePicker.jsx       // 기간 선택 (통계용)
├─ CategoryEditor.jsx        // 카테고리 추가/수정 (드래그 & 드롭)
└─ RichTextInput.jsx         // Quill 래퍼 (기존 PostEditor에서 분리)
```

#### D. 네비게이션 컴포넌트

```javascript
// components/navigation/
├─ Breadcrumb.jsx            // 경로 표시 (/blog/:username/category/...)
├─ VerticalNav.jsx           // 좌측 세로 네비 (설정 페이지 탭)
├─ FilterBar.jsx             // 정렬/필터 (피드, 포스트 목록)
└─ Pagination.jsx            // 페이지 네이션 (기존 무한 스크롤 대안)
```

#### E. 차트/통계 컴포넌트

```javascript
// components/charts/
├─ LineChart.jsx             // 선 차트 (방문자 추이)
├─ BarChart.jsx              // 막대 차트 (월별 포스트)
├─ HeatmapChart.jsx          // 히트맵 (시간대별)
└─ StatisticsOverview.jsx    // KPI 카드 그룹
```

#### F. 모달/다이얼로그 컴포넌트

```javascript
// components/modals/
├─ FollowModal.jsx           // 팔로우/언팔로우 확인
├─ ShareModal.jsx            // 포스트 공유
├─ ConfirmDialog.jsx         // 삭제 확인
└─ PreviewModal.jsx          // 블로그 설정 미리보기 (전체 페이지)
```

---

### 4.2 컴포넌트 계층도

```
App.jsx
├─ Layout (Router Provider)
│  ├─ Nav (기존, 확장)
│  │  ├─ SearchInput (신규)
│  │  └─ NotificationBell (신규)
│  ├─ Pages
│  │  ├─ BlogHome (신규)
│  │  │  ├─ BlogHeader (신규)
│  │  │  ├─ TwoColumnLayout (신규)
│  │  │  │  ├─ BlogSidebar (신규)
│  │  │  │  │  ├─ CategoryTree (신규)
│  │  │  │  │  ├─ RecentPosts (기존)
│  │  │  │  │  └─ PopularPosts (신규)
│  │  │  │  └─ PostList (기존, 리팩토링)
│  │  │  │     └─ PostCard (신규)
│  │  │  └─ BlogFooter (신규)
│  │  │
│  │  ├─ MainFeed (신규)
│  │  │  ├─ FeedNav (신규)
│  │  │  └─ FeedList (신규)
│  │  │     └─ FeedItem (신규)
│  │  │
│  │  ├─ SearchResults (신규)
│  │  │  ├─ SearchHeader (신규)
│  │  │  ├─ SearchTabs (신규)
│  │  │  └─ ResultList (신규)
│  │  │
│  │  ├─ NotificationCenter (신규)
│  │  │  ├─ NotificationNav (신규)
│  │  │  └─ NotificationList (신규)
│  │  │     └─ NotificationItem (신규)
│  │  │
│  │  ├─ BlogSettings (신규)
│  │  │  ├─ SettingsNav (신규)
│  │  │  ├─ SettingsPanel (신규)
│  │  │  │  ├─ SkinSelector (신규)
│  │  │  │  ├─ CategoryEditor (신규)
│  │  │  │  └─ CustomCSSEditor (신규)
│  │  │  └─ PreviewPanel (신규)
│  │  │
│  │  └─ [기존 페이지들]
│  │     ├─ PostEditor (기존, 리팩토링 - RichTextInput 분리)
│  │     ├─ PostDetail (기존)
│  │     │  └─ CommentSection (기존)
│  │     ├─ MyPosts (기존)
│  │     └─ Admin/* (기존)
│  │
│  └─ Footer (신규)
```

---

## 5. 상태관리 전략

### 5.1 현재 상태 관리 문제점

| 위치 | 상태 | 문제점 |
|------|------|--------|
| localStorage | token, user | 페이지 새로고침 후 재검증 필요 |
| ThemeContext | theme | 전역이지만 로컬스토리지 의존성 있음 |
| SkinContext | skin | 확장성 부족 (유저별 스킨 미지원) |
| 컴포넌트 로컬 | posts, comments, form 등 | prop drilling, 중복 요청 |

### 5.2 제안: **Zustand 기반 상태관리**

#### Why Zustand?
- Redux보다 보일러플레이트 적음
- Context API보다 성능 좋음 (선택적 구독)
- persist 미들웨어로 localStorage 통합
- TypeScript 지원 우수

#### 아키텍처

```javascript
// stores/index.js
export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'auth-storage' }
  )
);

export const useBlogStore = create((set) => ({
  // 블로거 프로필
  blogger: null,
  categories: [],
  setBlogger: (blogger) => set({ blogger }),
  setCategories: (categories) => set({ categories }),

  // 캐시 (메모리)
  postsCache: {},
  setPostsCache: (username, posts) =>
    set((state) => ({
      postsCache: { ...state.postsCache, [username]: posts },
    })),
}));

export const useUIStore = create((set) => ({
  // 전역 UI 상태
  sidebarOpen: true,
  theme: 'light',
  skin: 'notion',
  notificationDrawerOpen: false,

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setTheme: (theme) => set({ theme }),
  setSkin: (skin) => set({ skin }),
  setNotificationDrawerOpen: (open) => set({ notificationDrawerOpen: open }),
}));

export const useNotificationStore = create((set) => ({
  notifications: [],
  unreadCount: 0,
  setNotifications: (notifications) => set({ notifications }),
  setUnreadCount: (count) => set({ unreadCount: count }),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    })),
}));
```

#### 설치 및 설정

```bash
npm install zustand
```

```javascript
// stores/middleware.js - 커스텀 미들웨어 (API 캐싱, 자동 동기화)
export const withAutoFetch = (initializer) => (set, get) => ({
  ...initializer(set, get),

  // API 캐시 + 자동 갱신
  fetchBlogger: async (username) => {
    const cached = get().blogger;
    if (cached?.username === username) return cached;

    const res = await getBloggerProfile(username);
    if (res.success) set({ blogger: res.data });
    return res.data;
  },
});
```

#### 사용 예시

```javascript
// BlogHome.jsx
const { blogger, categories, setBlogger, setCategories } = useBlogStore();
const { username } = useParams();

useEffect(() => {
  // 캐시 확인
  if (blogger?.username === username) return;

  // API 호출
  getBloggerProfile(username).then(res => {
    if (res.success) setBlogger(res.data);
  });
}, [username]);
```

#### State 구조

```
stores/
├─ authStore.js      // 인증 (token, user)
├─ blogStore.js      // 블로그 (blogger, categories, cache)
├─ feedStore.js      // 피드 (posts, filters)
├─ uiStore.js        // UI (sidebar, theme, skin)
├─ notificationStore.js  // 알림
└─ searchStore.js    // 검색 (results, query)
```

---

## 6. 성능 최적화 방안

### 6.1 코드 스플리팅 (Route-based)

```javascript
// App.jsx
import { lazy, Suspense } from 'react';

const PostList = lazy(() => import('./pages/PostList'));
const PostDetail = lazy(() => import('./pages/PostDetail'));
const BlogHome = lazy(() => import('./pages/blog/BlogHome'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminPosts'));

const router = createBrowserRouter([
  {
    path: '/posts',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <PostList />
      </Suspense>
    ),
  },
  // ...
]);
```

**효과**: 초기 번들 크기 50% 감소, 페이지 이동 시 필요한 코드만 로드

### 6.2 라이브러리 번들 최적화

| 라이브러리 | 용도 | 대안 | 크기 감소 |
|-----------|------|------|---------|
| recharts | 차트 | 경량: nivo 또는 visx | -30KB |
| quill | 에디터 | 옵션 1: tiptap (가벼움) 또는 옵션 2: 현재 유지 | -50KB |
| md-editor | Markdown | 기존 유지 또는 marked+highlight 조합 | 선택 |

### 6.3 이미지 최적화

```javascript
// components/OptimizedImage.jsx
import { useState } from 'react';

export default function OptimizedImage({ src, alt, placeholder }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      {!loaded && placeholder && <img src={placeholder} alt={alt} />}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        style={{ opacity: loaded ? 1 : 0 }}
      />
    </>
  );
}

// 사용: Vite 이미지 import as URL
import thumbnail from './thumb.jpg?url&w=300';
```

**방법**:
1. **자동 WebP 변환**: Vite plugin (`vite-plugin-imagemin`)
2. **Lazy loading**: `loading="lazy"` 속성
3. **Thumbnail**: 서버에서 생성 (기존 Pillow)

### 6.4 가상화 (Virtualization)

무한 스크롤 리스트가 커질 때:

```bash
npm install react-window
```

```javascript
// hooks/useVirtualizedList.js
import { FixedSizeList } from 'react-window';

export default function VirtualizedPostList({ posts }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={posts.length}
      itemSize={120}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <PostCard post={posts[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}
```

**적용 대상**: 1000개+ 아이템 목록 (이웃 목록, 통계 테이블 등)

### 6.5 메모이제이션 (Memoization)

```javascript
// 컴포넌트 메모이제이션
import { memo } from 'react';

const PostCard = memo(({ post, onLike }) => {
  return <div>...</div>;
}, (prevProps, nextProps) => {
  // 커스텀 비교 로직 (true = 같음, 재렌더링 skip)
  return prevProps.post.id === nextProps.post.id;
});

// 콜백 메모이제이션
const handleLike = useCallback((id) => {
  likePost(token, id);
}, [token]);

// 계산 결과 메모이제이션
const topPosts = useMemo(() => {
  return posts.sort((a, b) => b.view_count - a.view_count).slice(0, 5);
}, [posts]);
```

---

## 7. 디자인 시스템 확장

### 7.1 컴포넌트 라이브러리 구조

```
frontend/src/
├─ components/
│  ├─ ui/                  # 기본 UI 컴포넌트 (원자)
│  │  ├─ Button.jsx
│  │  ├─ Input.jsx
│  │  ├─ Card.jsx
│  │  ├─ Badge.jsx
│  │  └─ Icon.jsx          # SVG 아이콘 라이브러리
│  │
│  ├─ composed/            # 합성 컴포넌트 (분자)
│  │  ├─ FormGroup.jsx
│  │  ├─ Modal.jsx
│  │  ├─ Dropdown.jsx
│  │  └─ TabNav.jsx
│  │
│  ├─ layouts/            # 레이아웃 컴포넌트 (유기)
│  │  ├─ TwoColumnLayout.jsx
│  │  ├─ AdminLayout.jsx
│  │  └─ CenterLayout.jsx
│  │
│  └─ features/           # 기능 컴포넌트 (페이지 레벨)
│     ├─ CommentSection/
│     ├─ PostCard/
│     ├─ BlogSidebar/
│     └─ ...
```

### 7.2 CSS Variables 확장

```css
/* index.css - 신규 변수 추가 */

:root {
  /* 기존 */
  --bg: #ffffff;
  --text: #6b6f76;
  --accent: #6c47ff;

  /* 신규: 반응형 레이아웃 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* 신규: 타이포그래피 */
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;

  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;

  /* 신규: 블로그 컬러 (스킨 별) */
  --blog-primary: var(--accent);
  --blog-secondary: var(--accent-bg);
  --blog-muted: var(--text-light);

  /* 신규: 반응형 미디어 쿼리 */
  --mobile-width: 480px;
  --tablet-width: 768px;
  --desktop-width: 1024px;
}

/* 스킨별 추가 변수 (forest 예시) */
[data-skin="forest"]:root {
  --accent: #2d6a4f;
  --blog-primary: #2d6a4f;
  --blog-secondary: rgba(45, 106, 79, 0.08);
}
```

### 7.3 Storybook 통합 (선택사항)

```bash
npm install --save-dev @storybook/react @storybook/addon-essentials
npx storybook init
```

```javascript
// components/ui/Button.stories.jsx
export default {
  title: 'UI/Button',
  component: Button,
};

export const Primary = {
  args: { children: 'Click me', variant: 'primary' },
};

export const Secondary = {
  args: { children: 'Click me', variant: 'secondary' },
};
```

---

## 8. 신규 API 요구사항 (BE 팀용)

현재 API + 신규 필요 API:

### 8.1 사용자 & 프로필 확장

```
GET  /api/users/:username              # 블로거 프로필 + 통계
GET  /api/users/:username/categories   # 블로거 카테고리
GET  /api/users/:username/posts        # 블로거 포스트 (필터 가능)
GET  /api/users/:username/followers    # 팔로워 목록
GET  /api/users/:username/following    # 팔로우 목록

POST   /api/users/:username/follow     # 팔로우
DELETE /api/users/:username/follow     # 언팔로우

GET  /api/users/search?q=keyword       # 블로거 검색
```

### 8.2 피드 & 알림

```
GET /api/posts/feed?page=1&sort=latest&following=true  # 피드
GET /api/notifications?page=1                          # 알림
GET /api/notifications/unread-count                    # 미읽 개수
PUT /api/notifications/:id/read                        # 읽음 표시

# WebSocket (선택사항)
WS /ws/notifications                                   # 실시간 알림
```

### 8.3 검색

```
GET /api/posts/search?q=keyword&page=1                 # 포스트 검색
GET /api/users/search?q=keyword                        # 블로거 검색
GET /api/tags/search?q=keyword                         # 태그 검색
GET /api/search/autocomplete?q=keyword                 # 자동완성
```

### 8.4 블로그 설정 & 통계

```
PUT /api/users/me/blog-settings       # 블로그 설정 변경
GET /api/users/:username/statistics   # 블로그 통계 (공개)
GET /api/users/me/statistics?period=monthly  # 내 블로그 통계 (상세)

# 카테고리
POST   /api/categories                # 카테고리 생성
PUT    /api/categories/:id            # 카테고리 수정
DELETE /api/categories/:id            # 카테고리 삭제
GET    /api/categories                # 카테고리 목록
```

### 8.5 게스트북

```
GET    /api/guestbooks/:username?page=1      # 게스트북 목록
POST   /api/guestbooks/:username             # 게스트북 작성
PUT    /api/guestbooks/:id                   # 게스트북 수정
DELETE /api/guestbooks/:id                   # 게스트북 삭제
```

---

## 9. 구현 우선순위 로드맵

### Phase 1: 기본 아키텍처 개선 (2-3주)
- [ ] **Zustand 마이그레이션**: 분산된 상태 통합
- [ ] **코드 스플리팅**: 라우트별 lazy loading
- [ ] **컴포넌트 리팩토링**: 재사용 가능한 컴포넌트 라이브러리 구축
- [ ] **TypeScript 도입** (선택사항): 타입 안전성

**산출물**: 확장 가능한 FE 아키텍처 구축

### Phase 2: 블로거 중심 기능 (4-5주)
- [ ] `/blog/:username` - 블로거 홈
- [ ] `/feed` - 이웃 피드 (무한 스크롤)
- [ ] `/my-blog/settings` - 블로그 설정 (스킨, 레이아웃, 카테고리)
- [ ] 팔로우/언팔로우 시스템 구현

**의존성**: Phase 1 완료 + BE 팔로우/피드 API

### Phase 3: 검색 & 알림 (2-3주)
- [ ] `/search` - 통합 검색 (포스트, 블로거, 태그)
- [ ] 검색 자동완성
- [ ] `/notifications` - 알림 센터
- [ ] 실시간 알림 (WebSocket, 선택사항)

**의존성**: Phase 2 완료 + BE 검색, 알림 API

### Phase 4: 통계 & 분석 (3-4주)
- [ ] `/my-blog/statistics` - 블로거 대시보드 (차트)
- [ ] `/blog/:username/statistics` - 공개 블로거 통계
- [ ] 차트 라이브러리 통합 (recharts)
- [ ] 통계 필터 (기간, 카테고리)

**의존성**: Phase 3 완료 + BE 통계 API

### Phase 5: 고급 기능 (선택사항, 4+주)
- [ ] `/blog/:username/guestbook` - 게스트북
- [ ] `/blog/:username/series/:seriesId` - 포스트 시리즈
- [ ] 댓글 실시간 알림
- [ ] 블로거 추천 (유사 블로거)
- [ ] 독자 분석 (고급)

---

## 10. 기술 스택 확장 제안

### 신규 의존성

```json
{
  "dependencies": {
    "zustand": "^4.4.0",           // 상태관리
    "recharts": "^2.10.0",         // 차트 (또는 chart.js)
    "react-window": "^8.8.0",      // 가상화 (선택)
    "axios-cache-adapter": "^2.7.3", // API 캐싱 (선택)
    "framer-motion": "^10.16.0"    // 애니메이션 (선택)
  },
  "devDependencies": {
    "typescript": "^5.0.0",        // 타입 안전성 (선택)
    "@testing-library/react": "^14.0.0", // 테스트
    "vitest": "^0.34.0"            // 테스트 러너
  }
}
```

### 선택사항 (Best Practices)

1. **TypeScript**: 런타임 에러 감소 (점진적 도입 가능)
2. **Error Boundary**: React Error Boundary로 에러 처리
3. **React Query**: API 캐싱 + 동기화 (Zustand + 병행 가능)
4. **Framer Motion**: 페이지 전환 애니메이션
5. **Testing**: Jest + React Testing Library

---

## 11. 마이그레이션 체크리스트

기존 코드를 손상하지 않으면서 단계적으로 확장:

### Phase 1 (아키텍처)
- [ ] Zustand 스토어 생성 (`stores/` 디렉토리)
- [ ] 기존 컴포넌트에서 Zustand 구독 시작 (기존 localStorage 병행)
- [ ] 코드 스플리팅 설정 (App.jsx lazy import)
- [ ] 컴포넌트 라이브러리 디렉토리 구조 작성

### Phase 2 (신규 페이지)
- [ ] 신규 라우트 추가 (App.jsx)
- [ ] 신규 페이지 컴포넌트 생성
- [ ] 신규 API 클라이언트 작성 (`api/` 폴더 확장)
- [ ] Zustand 스토어 확장

### Phase 3 (리팩토링)
- [ ] 기존 컴포넌트를 재사용 라이브러리로 모듈화
- [ ] 공통 로직을 훅으로 추출
- [ ] 타입스크립트 점진적 도입 (선택)

---

## 12. 구현 예시 코드

### 12.1 Zustand 스토어 예시

```javascript
// stores/useBlogStore.js
import create from 'zustand';
import { persist } from 'zustand/middleware';

export const useBlogStore = create(
  persist(
    (set, get) => ({
      // 상태
      bloggers: {}, // { [username]: { username, name, followers, ... } }
      postsCache: {}, // { [username]: [posts...] }

      // 액션
      setBlogger: (username, blogger) =>
        set((state) => ({
          bloggers: { ...state.bloggers, [username]: blogger },
        })),

      getPostsByAuthor: (username, page = 1) => {
        const cache = get().postsCache[username];
        if (cache?.page === page) return cache.posts;
        return null;
      },

      setPostsByAuthor: (username, posts, page) =>
        set((state) => ({
          postsCache: {
            ...state.postsCache,
            [username]: { posts, page },
          },
        })),
    }),
    { name: 'blog-storage' }
  )
);
```

### 12.2 신규 페이지 컴포넌트 예시

```javascript
// pages/BlogHome.jsx
import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useBlogStore } from '../stores/useBlogStore';
import { getBloggerProfile, listPosts } from '../api/posts';
import TwoColumnLayout from '../components/layouts/TwoColumnLayout';
import BlogHeader from '../components/features/BlogHeader';
import BlogSidebar from '../components/features/BlogSidebar';
import PostList from '../components/features/PostList';

export default function BlogHome() {
  const { username } = useParams();
  const { blogger, setBlogger } = useBlogStore();

  useEffect(() => {
    if (blogger?.username !== username) {
      getBloggerProfile(username).then(res => {
        if (res.success) setBlogger(username, res.data);
      });
    }
  }, [username]);

  if (!blogger) return <LoadingSpinner />;

  return (
    <div className="blog-home">
      <BlogHeader blogger={blogger} />
      <TwoColumnLayout
        sidebar={<BlogSidebar username={username} />}
        main={<PostList author={username} />}
      />
    </div>
  );
}
```

### 12.3 신규 API 클라이언트

```javascript
// api/bloggers.js
import apiClient from './apiClient';

export const getBloggerProfile = async (username) => {
  return apiClient.get(`/users/${username}`);
};

export const followBlogger = async (token, username) => {
  return apiClient.post(`/users/${username}/follow`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const unfollowBlogger = async (token, username) => {
  return apiClient.delete(`/users/${username}/follow`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const listFollowing = async (token, page = 1) => {
  return apiClient.get(`/users/me/following?page=${page}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};
```

---

## 13. 성능 지표 목표 (Performance Metrics)

| 지표 | 현재 | 목표 | 방법 |
|------|------|------|------|
| First Contentful Paint (FCP) | ~2.5s | <1.5s | 코드 스플리팅, 이미지 최적화 |
| Largest Contentful Paint (LCP) | ~3.5s | <2.5s | 리소스 로딩 최적화 |
| Cumulative Layout Shift (CLS) | 0.15 | <0.1 | 스켈레톤 로딩, 고정 크기 |
| Time to Interactive (TTI) | ~4s | <2.5s | 번들 크기 감소, lazy loading |
| Bundle Size | ~350KB | <250KB | 트리 셰이킹, 라이브러리 선택 |

---

## 14. 보안 고려사항

| 위험 | 현재 상태 | 완화 방법 |
|------|---------|---------|
| XSS (PostDetail dangerouslySetInnerHTML) | ⚠️ | Quill의 기본 sanitization 활용, 서버 검증 강화 |
| JWT 탈취 (localStorage) | ⚠️ | HttpOnly 쿠키 + secure flag (BE 설정) |
| CSRF (상태 변화 API) | ⚠️ | CSRF 토큰 추가 (BE FLASK-CORS) |
| 권한 우회 (클라이언트 검증만) | ⚠️ | 서버 API 권한 검증 필수 (이미 구현) |
| API 레이트 리미팅 부재 | ⚠️ | BE에서 Rate Limiting 추가 |

---

## 15. 결론 및 권장사항

### 15.1 즉시 추천 (Next 2-4주)

1. **Zustand 마이그레이션**: 상태 관리 고도화
2. **코드 스플리팅**: 초기 로딩 속도 개선
3. **컴포넌트 라이브러리화**: 재사용성 증대
4. **블로거 홈 페이지 구현** (`/blog/:username`)

### 15.2 중기 목표 (1-2개월)

1. **피드 & 팔로우 시스템**
2. **통합 검색 및 알림**
3. **블로그 통계 대시보드**

### 15.3 장기 비전 (2-3개월+)

1. **TypeScript 마이그레이션**
2. **고급 분석 & 독자 인사이트**
3. **실시간 기능 확대 (WebSocket)**
4. **모바일 앱 개발** (React Native)

---

## 부록: 파일 구조 변경안

```diff
frontend/src/
├─ api/
│  ├─ posts.js
│  ├─ auth.js
│  ├─ comments.js
│  ├─ media.js
│  ├─ admin.js
│  ├─ settings.js
│  ├─ bloggers.js         # 신규
│  ├─ feed.js             # 신규
│  ├─ notifications.js    # 신규
│  ├─ search.js           # 신규
│  └─ apiClient.js        # 신규 (axios 인스턴스 추상화)
│
├─ components/
│  ├─ ui/                 # 신규 (원자 컴포넌트)
│  │  ├─ Button.jsx
│  │  ├─ Input.jsx
│  │  ├─ Card.jsx
│  │  └─ Icon.jsx
│  ├─ composed/           # 신규 (합성 컴포넌트)
│  │  ├─ FormGroup.jsx
│  │  ├─ Modal.jsx
│  │  └─ TabNav.jsx
│  ├─ layouts/            # 신규 (레이아웃)
│  │  ├─ TwoColumnLayout.jsx
│  │  └─ AdminLayout.jsx
│  ├─ features/           # 신규 (기능 컴포넌트)
│  │  ├─ BlogHeader/
│  │  ├─ BlogSidebar/
│  │  ├─ PostCard/
│  │  └─ ...
│  ├─ context/
│  │  ├─ ThemeContext.jsx
│  │  └─ SkinContext.jsx
│  ├─ Nav.jsx
│  ├─ CommentSection.jsx
│  └─ Sidebar.jsx
│
├─ hooks/
│  ├─ useInfiniteScroll.js
│  ├─ useAuth.js          # 신규 (Zustand 래퍼)
│  ├─ useBlog.js          # 신규
│  ├─ useFeed.js          # 신규
│  └─ useNotifications.js # 신규
│
├─ pages/
│  ├─ Login.jsx
│  ├─ Register.jsx
│  ├─ Profile.jsx
│  ├─ PostList.jsx
│  ├─ PostDetail.jsx
│  ├─ PostEditor.jsx
│  ├─ MyPosts.jsx
│  ├─ admin/
│  │  ├─ AdminPosts.jsx
│  │  ├─ AdminUsers.jsx
│  │  ├─ AdminComments.jsx
│  │  └─ AdminSettings.jsx
│  ├─ blog/               # 신규 (블로거 기능)
│  │  ├─ BlogHome.jsx
│  │  ├─ CategoryPosts.jsx
│  │  ├─ SeriesPosts.jsx
│  │  ├─ GuestBook.jsx
│  │  ├─ BlogSettings.jsx
│  │  └─ BlogStatistics.jsx
│  ├─ feed/               # 신규 (커뮤니티)
│  │  ├─ MainFeed.jsx
│  │  ├─ NotificationCenter.jsx
│  │  ├─ SearchResults.jsx
│  │  └─ FollowingList.jsx
│  └─ NotFound.jsx
│
├─ stores/                # 신규 (Zustand)
│  ├─ index.js
│  ├─ authStore.js
│  ├─ blogStore.js
│  ├─ feedStore.js
│  ├─ uiStore.js
│  ├─ notificationStore.js
│  └─ searchStore.js
│
├─ utils/                 # 신규 (유틸리티)
│  ├─ formatDate.js
│  ├─ debounce.js
│  └─ validators.js
│
├─ styles/                # 신규 (CSS 모듈화)
│  ├─ index.css
│  ├─ components.css
│  ├─ layouts.css
│  └─ themes.css
│
├─ App.jsx
├─ main.jsx
├─ vite.config.js
└─ package.json
```

---

**보고서 작성 완료**
**담당자**: 시니어 프론트엔드 개발자
**다음 단계**: 팀 리더 검토 및 구현 로드맵 확정
