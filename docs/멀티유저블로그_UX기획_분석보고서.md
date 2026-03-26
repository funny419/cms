# 대형 블로그 플랫폼 수준 서비스 구축을 위한 CMS UX/기능 기획 분석 보고서

**작성일:** 2026-03-26
**분석 대상:** CMS 프로젝트 (React+Flask+MariaDB)
**목표:** 단일 사이트 개인 블로그 → 대형 블로그 플랫폼급 멀티 유저 블로그 플랫폼 진화

---

## 1. 현재 UX/기능 현황 분석

### 1.1 현재 구현 상태

#### ✅ 완료된 기능

| 영역 | 기능 | 상세 |
|------|------|------|
| **인증** | 로그인/회원가입 | JWT 토큰 기반, RBAC (admin/editor/deactivated) |
| **포스트 관리** | CRUD + 에디터 | WYSIWYG (react-quill-new) + Markdown 2중 탭, 이미지 업로드 |
| **포스트 통계** | 조회수/댓글수/추천수 | 포스트 상세 페이지 표시 |
| **포스트 추천** | 좋아요 토글 | 로그인 사용자 전용, 본인 글 제외, 1인 1추천 |
| **페이지네이션** | 인피니트 스크롤 | PostList/MyPosts/AdminPosts/AdminComments 4개 페이지 지원 |
| **포스트 검색** | 제목 키워드 검색 | 300ms 디바운스, PostList/AdminPosts 지원 |
| **포스트 필터** | 상태 필터 | AdminPosts에서 published/draft/scheduled 구분 |
| **개인 블로그** | `/my-posts` | 내 글 전체(draft+published) 조회 및 편집/삭제 |
| **미디어 시스템** | 파일 업로드 | UUID 파일명, Pillow 썸네일(300×300), path traversal 방어 |
| **파일 서빙** | 개발용 nginx-files | `/uploads/` 경로로 파일 공개 제공 |
| **댓글 시스템** | 계층형 댓글 | 1단 답글, 로그인/게스트 분기, 수정/삭제 소유권 인증 |
| **사이트 설정** | 스킨 관리 | Notion/Forest/Ocean/Rose 4종 프리셋 |
| **Admin 대시보드** | 포스트/회원/댓글 관리 | 검색, 필터, 페이지네이션, role 변경, 비활성화 |

#### ❌ 미구현 (계획된) 기능

| 기능 | 비고 |
|------|------|
| 유저별 블로그 (`/blog/:username`) | 스펙 완성 |
| 카테고리 | 미계획 |
| 태그 | 미계획 |
| 이웃/구독 시스템 | 미계획 |
| 포스트 시리즈 | 미계획 |
| 게스트북 | 미계획 |
| 블로그 통계 (방문자 분석) | 미계획 |
| 알림 시스템 | 미계획 |
| 포스트 공개 설정 (전체/이웃/비공개) | 미계획 |
| 포스트 예약 발행 | 스키마 존재 (status='scheduled') |
| RSS 피드 | 미계획 |
| 소셜 공유 버튼 | 미계획 |
| 임시저장 (자동) | 스키마 존재 (status='draft') |

### 1.2 현재 UI/UX의 강점과 약점

**강점:**
- ✅ 깔끔한 Notion/Bear 테마로 현대적 디자인
- ✅ 라이트/다크 모드 완벽 지원
- ✅ 4가지 스킨 프리셋으로 개인화 가능
- ✅ 인피니트 스크롤로 자연스러운 탐색
- ✅ WYSIWYG + Markdown 이중 모드로 사용자 선택 존중
- ✅ 로그인/비로그인 역할별 UI 분리 명확

**약점:**
- ❌ 단일 사이트 CMS → 개인별 블로그 공간 부재
- ❌ 사용자 프로필 페이지 없음 (username 정보만 표시)
- ❌ 다른 사용자 글 찾기 어려움 (author 필터 미구현)
- ❌ 포스트 카테고리/태그 분류 체계 없음
- ❌ 블로그 홈 구성 없음 (프로필, 소개, 최근 글 등)
- ❌ 사용자 간 상호작용 미비 (이웃, 구독 등)
- ❌ 포스트 시계열 네비게이션만 제공 (이전/다음 글)
- ❌ 검색이 제목만 대상 (본문, 태그, 작성자 검색 불가)
- ❌ 알림 시스템 부재 (댓글/추천 알림)
- ❌ 방문자 통계 미흡 (조회수만 수집)

---

## 2. 대형 블로그 플랫폼 핵심 기능 분석

### 2.1 필수 구현 기능 (핵심 경험 5가지)

#### **[필수 1] 유저별 블로그 홈 (`/blog/:username`)**

**목적:** 각 사용자의 개인 블로그 공간 구성
**대형 블로그 플랫폼 사례:**
- 프로필 영역: 블로그 주인 정보, 닉네임, 소개글, 프로필 사진
- 카테고리/태그 클라우드: 콘텐츠 네비게이션
- 최근 글 목록: 최신 콘텐츠 강조
- 통계 요약: 방문자/포스트 수

**현재 상태:** `/my-posts`는 로그인 유저의 전체 글 (draft+published)만 표시, 다른 사용자 블로그 접근 불가

**구현 범위:**
```
GET /api/users/:username           # 사용자 정보 조회
GET /api/posts?author=username    # 해당 사용자의 published 포스트만
GET /api/users/:username/stats    # 포스트 수, 최근 방문자 등
```

**UI 요소:**
- 프로필 카드 (이름, 소개, 팔로우 버튼)
- 카테고리 사이드바 (현재 미구현)
- 최근 글 위젯
- 월별/주별 방문자 수 차트

---

#### **[필수 2] 카테고리 시스템**

**목적:** 포스트 분류로 사용자 경험 향상
**대형 블로그 플랫폼 사례:**
- 다단계 카테고리 (상위/하위)
- 카테고리별 포스트 목록 (`/blog/:username/category/:cat-name`)
- Admin에서 CRUD 관리
- 각 포스트는 1개 카테고리 할당

**현재 상태:** 카테고리 개념 없음 (모든 포스트 평면 구조)

**필요 DB 변경:**
```python
class Category(Base):
    id: Mapped[int] = mapped_column(primary_key=True)
    blog_id: Mapped[int] = mapped_column(ForeignKey('users.id'))  # 각 블로그 소유자
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey('categories.id'))
    order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

# Post 모델 변경:
# category_id: Mapped[Optional[int]] = mapped_column(ForeignKey('categories.id'))
```

**구현 API:**
```
POST /api/categories               # 카테고리 생성 (admin)
GET /api/users/:username/categories   # 해당 블로그 카테고리 목록
PUT /api/categories/:id            # 수정
DELETE /api/categories/:id         # 삭제
GET /api/posts?category=cat-id     # 카테고리별 포스트 조회
```

---

#### **[필수 3] 태그 시스템**

**목적:** 포스트 크로스 분류 및 검색
**대형 블로그 플랫폼 사례:**
- 포스트당 여러 태그 할당
- 태그 클라우드 (사이드바)
- `/blog/:username/tag/:tag-name` 페이지
- 태그 검색 자동완성

**현재 상태:** 태그 개념 없음

**필요 DB 스키마:**
```python
class Tag(Base):
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    blog_id: Mapped[int] = mapped_column(ForeignKey('users.id'))  # 블로그별 태그
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint('blog_id', 'name', name='uq_blog_tag'),)

class PostTag(Base):
    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey('posts.id'))
    tag_id: Mapped[int] = mapped_column(ForeignKey('tags.id'))
    __table_args__ = (UniqueConstraint('post_id', 'tag_id', name='uq_post_tag'),)
```

**구현 API:**
```
GET /api/users/:username/tags      # 해당 블로그 태그 목록 + 포스트 수
GET /api/posts?tags=tag1,tag2      # 태그별 포스트 조회 (OR 연산)
POST /api/posts/:id/tags           # 포스트에 태그 추가
DELETE /api/posts/:id/tags/:tag-id # 포스트에서 태그 제거
```

---

#### **[필수 4] 포스트 공개 설정 (전체/이웃/비공개)**

**목적:** 공개 범위 제어로 개인정보/초안 보호
**대형 블로그 플랫폼 사례:**
- 전체공개: 모든 사용자 가능
- 이웃공개: 이웃(구독자)만 가능
- 비공개: 작성자만 가능

**현재 상태:** 포스트는 published/draft/scheduled만 구분 (공개 범위 개념 없음)

**DB 변경:**
```python
# Post 모델에 추가:
visibility: Mapped[str] = mapped_column(String(20), default='public')  # public, members_only, private
```

**변경 로직:**
```
GET /api/posts?status=published   # 현재: 모든 published 반환
변경 후: visibility='public' AND status='published'인 것만 반환

본인이 로그인 중이면:
- 자신의 모든 published 포스트 (visibility 상관없음)
- 다른 유저의 public 포스트
```

---

#### **[필수 5] 포스트 예약 발행**

**목적:** 미리 포스트 작성 후 자동 발행
**대형 블로그 플랫폼 사례:**
- 포스트 편집 화면에서 발행 시간 지정
- 지정 시간에 자동 발행 (이메일 알림)

**현재 상태:**
- DB `Post.status = 'scheduled'` 존재
- 실제 스케줄링 미구현 (자동 발행 프로세스 없음)

**구현 필요:**
```python
# Post 모델에 추가:
published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))  # 예약 발행 시간

# 백그라운드 작업 (celery 또는 APScheduler):
# 1분마다 체크 → published_at <= now()인 draft 포스트 → status 변경
```

**API 변경:**
```
POST /api/posts              # 요청 바디에 published_at 포함 가능
{
  "title": "...",
  "content": "...",
  "status": "draft",           # 또는 "scheduled"
  "published_at": "2026-03-28T10:00:00Z"  # 예약 발행 시간
}
```

---

### 2.2 선택 구현 기능 (가치 높음, 우선순위 2단계)

| 기능 | 설명 | 난이도 | 기대 효과 |
|------|------|--------|---------|
| **이웃/구독** | 다른 블로그 구독, 이웃 새 글 피드 | 중 | 사용자 간 상호작용 증대 |
| **알림 시스템** | 댓글/추천/구독자 새 글 알림 | 중 | 사용자 재방문율 증가 |
| **블로그 통계** | 일별/월별 방문자, 인기 포스트 | 중 | 사용자 분석 욕구 충족 |
| **검색 고도화** | 제목+본문+태그 전체 검색, 작성자 필터 | 중 | 콘텐츠 발견성 향상 |
| **포스트 시리즈** | 연관 포스트 묶음, 시리즈 네비게이션 | 낮 | 장문 콘텐츠 제공 개선 |
| **게스트북** | 방문자 메시지 시스템 | 낮 | 사용자 커뮤니티 형성 |
| **소셜 공유** | 카카오톡/트위터/페이스북 공유 | 낮 | 바이럴 마케팅 |
| **RSS 피드** | `/blog/:username/feed.xml` | 낮 | 구독자 편의성 |
| **프로필 커스터마이징** | 블로그 설명, 프로필 사진, 링크 | 낮 | 개인화 강화 |

---

## 3. 기능 갭 분석 (현재 vs 목표)

### 3.1 기능 비교표

| 기능 | 현재 | 대형 블로그 플랫폼 | 갭 | 우선순위 |
|------|------|-------------|-----|---------|
| **유저별 블로그** | `/my-posts` (자신만) | `/blog/:username` (공개) | 높음 | **1순위** |
| **카테고리** | ❌ | ✅ 다단계 | 높음 | **1순위** |
| **태그** | ❌ | ✅ 다중 | 높음 | **1순위** |
| **공개 설정** | ❌ (public/draft만) | ✅ public/members/private | 중 | **2순위** |
| **예약 발행** | 스키마만 | ✅ 자동 스케줄 | 중 | **2순위** |
| **포스트 검색** | 제목만 | 제목+본문+태그 | 중 | **2순위** |
| **프로필** | 기본정보만 | 소개글, 프로필사진 | 중 | **2순위** |
| **이웃/구독** | ❌ | ✅ | 중 | **3순위** |
| **알림** | ❌ | ✅ 댓글/추천/구독 | 중 | **3순위** |
| **통계** | 조회수만 | 일별/월별 분석 | 낮 | **3순위** |
| **게스트북** | ❌ | ✅ | 낮 | **4순위** |
| **시리즈** | ❌ | ✅ | 낮 | **4순위** |
| **RSS** | ❌ | ✅ | 낮 | **4순위** |

### 3.2 아키텍처 영향도

| 변경 영역 | 영향도 | 설명 |
|----------|--------|------|
| **DB 스키마** | 높음 | Category, Tag, PostTag 테이블 추가 필요 |
| **API 구조** | 중 | 새 엔드포인트 추가 (categories, tags, users, subscriptions) |
| **프론트엔드 페이지** | 높음 | `/blog/:username`, `/blog/:username/category/:cat`, `/blog/:username/tag/:tag` 추가 |
| **권한 검사** | 중 | visibility 기반 접근 제어 추가 |
| **검색 엔진** | 중 | Fulltext 인덱스 추가 (제목+본문+태그) |
| **백그라운드 작업** | 낮 | 예약 발행 스케줄러 (선택) |

---

## 4. 사용자 플로우 설계 (핵심 3가지)

### 4.1 사용자 여정 1: "다른 블로그 발견 및 구독"

```
[커뮤니티 홈] → "인기 블로그" 위젯 → [유저A 블로그]
                                    ↓
                              프로필 카드 (소개글, 팔로우 버튼)
                                    ↓
                            최근 글 목록 (with 카테고리)
                                    ↓
                          [포스트 상세] → 댓글/추천
                                    ↓
                     "유저A의 다른 글" (같은 카테고리)
```

**현재 상태:** 다른 사용자 블로그 접근 불가 (PostList에서 author_username만 표시)

**필요 구현:**
- `GET /api/users/:username` — 사용자 정보 조회
- `GET /api/posts?author=username` — 해당 사용자의 포스트 목록
- `/blog/:username` 페이지 구현
- "다른 글 보기" 링크 추가

---

### 4.2 사용자 여정 2: "콘텐츠 탐색 및 검색"

```
[블로그 홈]
    ├─→ [카테고리 클릭] → 해당 카테고리 포스트 목록
    ├─→ [태그 클릭] → 해당 태그 포스트 목록
    ├─→ [검색] → 제목+본문+태그 결과
    └─→ [최근 글] → 작성 순서대로 정렬

예: "React 카테고리" → "React" 태그 → "React 성능 최적화" 포스트
```

**현재 상태:**
- 검색 = 제목만 키워드 검색 (본문/태그 불가)
- 카테고리/태그 개념 없음

**필요 구현:**
- Category 모델 + API
- Tag 모델 + API
- 검색 쿼리 확장 (Fulltext 인덱스)
- `/blog/:username/category/:cat-id` 페이지
- `/blog/:username/tag/:tag-id` 페이지

---

### 4.3 사용자 여정 3: "포스트 작성 및 발행 관리"

```
[내 블로그] → [+ 새 글] → [에디터]
                           ├─ 제목, 본문 (WYSIWYG/Markdown)
                           ├─ 카테고리 선택
                           ├─ 태그 추가
                           ├─ 공개 설정 (전체/이웃/비공개)
                           ├─ 발행 시간 선택 (즉시 / 예약)
                           └─ [발행] or [임시저장]
                               ↓
                           [발행된 포스트]
                           ├─ 조회수, 댓글, 추천 실시간 집계
                           └─ 방문자 로그 수집
```

**현재 상태:**
- 카테고리/태그 미지원
- 공개 설정 미지원
- 예약 발행 (스키마만 존재, 실제 동작 없음)
- 방문자 로그 수집 안함

**필요 구현:**
- 에디터 UI에 카테고리 드롭다운 추가
- 태그 입력 (자동완성)
- Visibility 라디오 버튼
- published_at 시간 선택
- 배경 스케줄러 (APScheduler)

---

## 5. UI/UX 개선 방안

### 5.1 페이지 구조 개선

#### **기존 구조**
```
/posts                 # 공개 포스트 목록
/posts/:id             # 포스트 상세
/posts/new, :id/edit   # 에디터
/my-posts              # 내 블로그 (로그인 필수)
/admin/*               # Admin 대시보드
```

#### **개선된 구조**
```
/                      # 커뮤니티 홈 (신규)
/posts                 # 전체 공개 포스트 (검색+필터)
/posts/:id             # 포스트 상세
/posts/new, :id/edit   # 에디터 (카테고리/태그/공개설정 추가)

/blog/:username        # 개인 블로그 홈 (신규)
├─ /blog/:username/posts          # 포스트 목록
├─ /blog/:username/category/:cat  # 카테고리별 (신규)
├─ /blog/:username/tag/:tag       # 태그별 (신규)
└─ /blog/:username/about          # 소개 페이지 (신규)

/my-posts              # 내 블로그 (로그인 필수, 편집 모드)
/my-blog/settings      # 블로그 설정 (카테고리/태그 관리)
/my-blog/analytics     # 블로그 통계 (신규)

/admin/*               # Admin 대시보드
```

### 5.2 컴포넌트 레이아웃 개선

#### **블로그 홈 (`/blog/:username`)**

```
┌─────────────────────────────────────┐
│  [블로그 헤더]                       │
│  ├─ 블로그 타이틀                   │
│  ├─ 프로필 이미지                   │
│  ├─ 소개글                          │
│  └─ [구독] [공유] 버튼              │
├─────────────────────────────────────┤
│ [좌측 사이드바]         [메인 콘텐츠] │
│                                     │
│ ◈ 카테고리                         │
│   ├─ 일상 (5)                     │
│   ├─ 기술 (12)                    │ 최근 글
│   └─ 독서 (3)                     │ 1. 제목1 (2026-03)
│                                    │ 2. 제목2 (2026-03)
│ ◈ 태그 클라우드                    │ 3. 제목3 (2026-03)
│   #react #javascript #nodejs      │
│                                    │ [페이지네이션]
│ ◈ 블로그 통계                      │
│   방문: 1,234                      │
│   글: 20개                         │
│                                    │
└─────────────────────────────────────┘
```

#### **포스트 에디터 개선**

```
[에디터 헤더]
├─ 제목 입력

[메인 편집 영역]
├─ WYSIWYG / Markdown 탭
├─ 본문 에디터
└─ [이미지 업로드] 버튼

[우측 사이드바 — 메타데이터]
├─ 카테고리
│  └─ [드롭다운] "기술" 선택
├─ 태그
│  └─ [입력] React, JavaScript 추가
├─ 공개 설정
│  ├─ ◉ 전체공개
│  ├─ ◯ 이웃공개
│  └─ ◯ 비공개
├─ 발행 설정
│  ├─ ◉ 즉시 발행
│  ├─ ◯ 예약 발행 [2026-03-28 10:00]
│  └─ ◯ 임시저장
└─ [발행] [취소] 버튼
```

### 5.3 검색/필터 UI 개선

#### **고급 검색 (검색 페이지)**

```
┌────────────────────────────────────┐
│ 통합 검색                          │
├────────────────────────────────────┤
│
│ 검색어: [___________] [검색]
│
│ ◇ 필터 (고급 옵션)
│   ├─ 작성자: [드롭다운/입력]
│   ├─ 카테고리: [멀티셀렉트]
│   ├─ 태그: [멀티셀렉트]
│   ├─ 날짜: [시작] ~ [종료]
│   ├─ 정렬: [최신순 ▼]
│   └─ [필터 적용]
│
│ 검색 결과: 12건
│ ┌─────────────────────────────┐
│ │ 1. 포스트 제목1            │
│ │    카테고리: 기술           │
│ │    태그: #react #javascript │
│ │    작성자: 유저A            │
│ │    2026-03-20 ·  댓글 3개   │
│ └─────────────────────────────┘
│ ...
```

### 5.4 알림/통지 시스템 UI (향후)

```
┌─ 🔔 (벨 아이콘)
│
├─ 새 댓글
│  └─ "사용자B"님이 당신의 포스트에 댓글을 남겼습니다. (1시간 전)
│
├─ 추천
│  └─ "사용자C"님이 "React 성능 최적화"를 추천했습니다. (3시간 전)
│
└─ 구독
   └─ "사용자D"님이 당신을 구독했습니다. (1일 전)
```

---

## 6. 단계별 구현 로드맵

### **Phase 1: 기본 블로그 구조 (2-3개월)**

#### 목표
개인 블로그 공간 확립, 콘텐츠 분류 시스템 구축

#### 마일스톤

| # | 기능 | 노력 | 순서 | 세부 |
|----|------|------|------|------|
| 1.1 | DB 스키마 확장 | 1주 | ◆◆ | Category, Tag, PostTag 테이블 + Post.category_id 컬럼 추가 |
| 1.2 | API: 카테고리 관리 | 1.5주 | ◆◆ | POST/PUT/DELETE /api/categories, GET /api/users/:username/categories |
| 1.3 | API: 태그 관리 | 1.5주 | ◆◆ | POST/PUT/DELETE /api/tags, POST/DELETE /api/posts/:id/tags |
| 1.4 | API: 사용자 정보 | 5일 | ◆ | GET /api/users/:username, User 프로필 확장 (bio, avatar_url) |
| 1.5 | API: 포스트 조회 확장 | 1주 | ◆◆ | GET /api/posts?author=, ?category=, ?tags=, ?q=(제목+본문) |
| 1.6 | FE: 블로그 홈 페이지 | 2주 | ◆◆◆ | `/blog/:username` 페이지, 프로필 카드, 카테고리 사이드바, 최근 글 위젯 |
| 1.7 | FE: 카테고리 페이지 | 1주 | ◆◆ | `/blog/:username/category/:cat-id` 페이지 |
| 1.8 | FE: 태그 페이지 | 1주 | ◆◆ | `/blog/:username/tag/:tag-id` 페이지 |
| 1.9 | FE: 에디터 개선 | 1.5주 | ◆◆◆ | 카테고리 드롭다운, 태그 입력 필드, 메타데이터 사이드바 |
| 1.10 | FE: 고급 검색 페이지 | 1.5주 | ◆◆ | `/search` 페이지, 작성자/카테고리/태그 필터, Fulltext 검색 |

**Phase 1 총 일정:** 약 12주 (3개월)

**Phase 1 완료 기준:**
- ✅ 사용자 고유 블로그 URL 접근 가능
- ✅ 카테고리로 포스트 분류 가능
- ✅ 태그 추가/제거 가능
- ✅ 제목+본문 통합 검색 가능
- ✅ 다른 사용자 블로그 공개 접근 가능

---

### **Phase 2: 공개 제어 및 예약 발행 (1.5-2개월)**

#### 목표
포스트 공개 범위 제어, 자동 예약 발행 기능 구현

#### 마일스톤

| # | 기능 | 노력 | 순서 |
|----|------|------|------|
| 2.1 | DB: Post.visibility, published_at 컬럼 추가 | 3일 | ◆ |
| 2.2 | API: 권한 검사 로직 | 1주 | ◆◆ | visibility 기반 접근 제어 (public/members_only/private) |
| 2.3 | API: 배경 스케줄러 (APScheduler) | 1.5주 | ◆◆◆ | 예약 발행 자동화, 시간대별 처리 |
| 2.4 | FE: 공개 설정 라디오 버튼 | 3일 | ◆ | PostEditor에 visibility 옵션 추가 |
| 2.5 | FE: 예약 발행 UI | 5일 | ◆◆ | published_at 시간 선택, 예약 취소 |
| 2.6 | FE: 포스트 공개 배지 | 3일 | ◆ | PostDetail/PostList에서 공개 범위 시각화 |
| 2.7 | Admin: 포스트 상태 모니터링 | 5일 | ◆ | 예약된 포스트 목록, 발행 실패 로그 |

**Phase 2 총 일정:** 약 6-8주 (1.5-2개월)

**Phase 2 완료 기준:**
- ✅ 포스트 공개 범위 선택 가능
- ✅ 예약된 시간에 자동 발행
- ✅ 이웃공개 포스트 권한 검사
- ✅ 발행 실패 시 Admin 알림

---

### **Phase 3: 상호작용 및 분석 (2-3개월)**

#### 목표
사용자 간 상호작용 확대, 블로그 분석 기능 제공

#### 마일스톤

| # | 기능 | 노력 | 우선순위 | 세부 |
|----|------|------|----------|------|
| 3.1 | 이웃/구독 시스템 | 2주 | 중 | Follow 모델, API, FE UI |
| 3.2 | 알림 시스템 | 2주 | 중 | Notification 모델, 푸시 알림 |
| 3.3 | 블로그 통계 | 1.5주 | 중 | 일별/월별 방문자, 인기 포스트, 차트 |
| 3.4 | 프로필 커스터마이징 | 1주 | 낮 | 프로필 이미지, 블로그 설명, 링크 |
| 3.5 | 포스트 시리즈 | 1주 | 낮 | Series 모델, 시리즈 네비게이션 |
| 3.6 | 게스트북 | 1주 | 낮 | Guestbook 모델, API, 페이지 |
| 3.7 | RSS 피드 | 3일 | 낮 | `/blog/:username/feed.xml` 엔드포인트 |
| 3.8 | 소셜 공유 | 3일 | 낮 | Share 버튼 (KakaoTalk, Twitter, Facebook) |

**Phase 3 총 일정:** 약 8-10주 (2-3개월)

**Phase 3 완료 기준:**
- ✅ 사용자 구독/이웃 기능
- ✅ 댓글/추천/구독 알림
- ✅ 방문자 분석 대시보드
- ✅ RSS 구독 지원

---

### **전체 로드맵 타임라인**

```
2026년
├─ 4월 (Phase 1 시작)
│  ├─ 1.1-1.3: DB 스키마, API 카테고리/태그 (완료: 4월 중순)
│  ├─ 1.4-1.5: API 사용자/포스트 조회 확장 (완료: 4월 말)
│  └─ 1.6-1.10: FE 페이지/검색/에디터 (완료: 6월 중순)
│
├─ 6월 (Phase 2 시작)
│  ├─ 2.1-2.3: DB, 권한 검사, 스케줄러 (완료: 7월 초)
│  └─ 2.4-2.7: FE UI, Admin 모니터링 (완료: 8월 초)
│
└─ 8월 (Phase 3 시작)
   ├─ 3.1-3.4: 상호작용, 분석, 커스터마이징 (완료: 10월 초)
   └─ 3.5-3.8: 부가 기능 (완료: 10월 말)
```

**전체 기간:** 약 6개월 (Phase 1~3)

---

## 7. 성공 지표 (KPI)

### 7.1 서비스 레벨 KPI

| KPI | 목표 | 측정 방법 |
|-----|------|---------|
| **사용자 확보** | 가입자 100명 | 회원가입 테이블 |
| **활성 사용자** | 월 30% DAU | 로그인 로그 |
| **콘텐츠 생산** | 월 포스트 200개 | Post 테이블 |
| **상호작용** | 포스트당 평균 댓글 2개 | Comment 테이블 |
| **블로그 방문** | 월 10K 유니크 방문자 | 방문자 로그 |

### 7.2 기능별 KPI

#### **Phase 1: 콘텐츠 분류**

| 지표 | 목표 | 기준 |
|------|------|------|
| 카테고리 활용도 | 포스트의 80% 분류됨 | Post.category_id IS NOT NULL |
| 태그 사용률 | 평균 포스트당 2.5개 태그 | PostTag 개수 / Post 개수 |
| 검색 조회수 | 월 1K 검색 | SearchLog 테이블 |
| 블로그 페이지 방문 | 월 3K 유니크 방문 | `/blog/:username` 페이지뷰 |

#### **Phase 2: 공개 제어**

| 지표 | 목표 | 기준 |
|------|------|------|
| 예약 발행 사용률 | 포스트의 20% 예약 | Post.published_at IS NOT NULL |
| 예약 정시 발행률 | 99.9% | 예약 발행 성공 / 전체 예약 |
| 공개 범위 다양성 | 포스트의 10% 비공개/이웃공개 | visibility != 'public' |

#### **Phase 3: 상호작용**

| 지표 | 목표 | 기준 |
|------|------|------|
| 구독자 확보 | 유저당 평균 5명 | Follow 관계 수 / User 수 |
| 알림 클릭율 | 40% | 알림 클릭 / 알림 발송 |
| RSS 구독 | 구독자의 30% | RSS 피드 다운로드 로그 |
| 재방문율 | 60% (주간) | 재방문 유저 / 전체 유저 |

### 7.3 기술 KPI

| 지표 | 목표 | 기준 |
|------|------|------|
| API 응답 시간 | P95 < 200ms | 백엔드 로그 |
| 검색 응답 시간 | < 500ms | Fulltext 인덱스 |
| 페이지 로딩 시간 | < 2s | WebVitals |
| 스케줄러 실패율 | < 0.1% | APScheduler 로그 |

---

## 8. 구현 시 고려 사항

### 8.1 데이터 마이그레이션

**문제:** 기존 포스트에 카테고리/태그가 없음

**해결책:**
```sql
-- 기본 카테고리 생성
INSERT INTO categories (blog_id, name, parent_id, order)
VALUES (각 사용자별, 'Uncategorized', NULL, 0);

-- 기존 포스트를 기본 카테고리로 분류
UPDATE posts SET category_id = (
  SELECT id FROM categories WHERE name='Uncategorized' AND blog_id=posts.author_id
) WHERE category_id IS NULL;
```

### 8.2 검색 최적화

**현재:** LIKE '%q%' 단순 검색 (느림)

**개선:**
```sql
-- Fulltext 인덱스 추가
ALTER TABLE posts ADD FULLTEXT INDEX ft_search (title, content, excerpt);

-- 쿼리 예시
SELECT * FROM posts
WHERE status='published' AND visibility='public'
AND MATCH(title, content) AGAINST('React' IN BOOLEAN MODE);
```

### 8.3 예약 발행 스케줄러

**선택지:**
1. **APScheduler** (경량, Python, 적합)
   ```python
   from apscheduler.schedulers.background import BackgroundScheduler
   scheduler = BackgroundScheduler()
   scheduler.add_job(publish_scheduled_posts, 'interval', minutes=1)
   scheduler.start()
   ```

2. **Celery + Redis** (분산 처리, 복잡)

**권장:** Phase 1에서는 APScheduler로 시작, 필요시 Phase 2에서 Celery로 마이그레이션

### 8.4 권한 검사 로직

```python
# 포스트 조회 시
def can_view_post(user_id, post: Post):
    if post.status != 'published':
        return post.author_id == user_id  # 작성자만 볼 수 있음

    if post.visibility == 'public':
        return True
    elif post.visibility == 'members_only':
        # 구독자만 볼 수 있음
        return is_follower(user_id, post.author_id)
    elif post.visibility == 'private':
        return post.author_id == user_id

    return False
```

### 8.5 성능 최적화

| 항목 | 조치 |
|------|------|
| **DB 인덱스** | category_id, tag_id, author_id, visibility, status, published_at |
| **API 캐싱** | 사용자 블로그 정보 (Redis, TTL: 1시간) |
| **페이지 캐싱** | 공개 포스트 목록 (TTL: 5분) |
| **이미지 최적화** | 썸네일 WebP 변환, CDN 배포 (R2 전환 시) |

---

## 9. 결론 및 권고사항

### 9.1 핵심 인사이트

1. **현재 CMS는 단일 블로그 플랫폼** → 대형 블로그 플랫폼급 멀티 블로그 플랫폼으로의 진화 필요
2. **기본 기능은 잘 구현됨** (CRUD, 에디터, 댓글) → 사용자 경험을 높이려면 **분류/발견 시스템** 필수
3. **카테고리/태그가 최우선** → 콘텐츠 네비게이션과 SEO 성능 동시 향상
4. **공개 설정과 예약 발행은 선택지 아닌 필수** → 사용자 신뢰도 향상, 계획적 발행 가능

### 9.2 즉시 구현 권고 (다음 2주)

1. **DB 스키마 확장** (Category, Tag, PostTag)
2. **Post 모델 확장** (category_id, visibility, published_at)
3. **마이그레이션 스크립트** (기존 데이터 보호)
4. **API 작성** (기본 CRUD)

이를 통해 Phase 1 기초를 다지고 전체 로드맵 진행 가능

### 9.3 위험 요소 및 완화 방안

| 위험 | 확률 | 완화 방안 |
|------|------|---------|
| 데이터 마이그레이션 오류 | 중 | 개발 환경에서 충분히 테스트 후 프로덕션 적용 |
| 권한 검사 로직 버그 | 높음 | 권한별 테스트 케이스 50개 이상 작성 |
| 스케줄러 시간대 문제 | 중 | UTC 기준 통일, 타임존 처리 철저 |
| 검색 성능 저하 | 낮음 | Fulltext 인덱스 + EXPLAIN 모니터링 |

---

## 부록: 디자인 시스템 (기존 유지)

### 색상 팔레트 (CSS Variables)

```css
/* Light Mode */
:root {
  --bg: #ffffff;
  --bg-subtle: #f5f5f5;
  --text: #1a1a1a;
  --text-light: #666;
  --accent: #7c3aed;  /* notion purple */
  --accent-bg: #ede9fe;
  --accent-text: #6d28d9;
}

/* Dark Mode */
[data-theme="dark"]:root {
  --bg: #1a1a1a;
  --bg-subtle: #2a2a2a;
  --text: #ffffff;
  --text-light: #bbb;
}
```

### 컴포넌트 클래스

```css
.btn, .btn-primary, .btn-ghost, .btn-danger
.card
.form-input, .form-textarea, .form-select
.alert, .alert-error, .alert-success
.badge
.post-list, .post-item, .post-title, .post-excerpt, .post-meta
```

현재 디자인 시스템을 유지하되, 새로운 컴포넌트 추가 시 일관성 유지.

---

**보고서 작성:**
시니어 UX 플래너 (Claude Code)
**최종 검토:**
기획 팀 리더
**배포 기준:**
Phase별 마일스톤 달성 시 검토
