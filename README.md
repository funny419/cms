# 📝 FunnyCMS

> **설치형 개인 블로그 플랫폼** — 내 서버에서 직접 운영하는 멀티유저 블로그 CMS

---

## 🌟 이런 분께 추천합니다

- 광고 없이 나만의 블로그를 운영하고 싶은 분
- 독자에게 구독(팔로우) 기능이 있는 블로그 플랫폼을 원하는 분
- 데이터를 직접 소유하고 싶은 분 (서드파티 의존 없음)
- 소규모 팀이나 커뮤니티에 설치형 블로그 솔루션이 필요한 분

---

## ✨ 주요 기능

### 👤 사용자 기능

| 기능 | 설명 |
|------|------|
| 글쓰기 | WYSIWYG 에디터 또는 Markdown 지원 |
| 카테고리 / 태그 | 글을 체계적으로 분류하고 탐색 |
| 이미지 업로드 | 글 내 이미지 삽입, 썸네일 자동 생성 |
| 공개 범위 설정 | 전체 공개 / 회원 공개 / 비공개 선택 |
| 댓글 | 로그인 사용자 + 게스트 댓글 지원 |
| 팔로우 / 이웃 피드 | 관심 블로거를 팔로우하고 최신 글 모아보기 |
| 시리즈 | 연재 글을 묶어서 순서대로 관리 |
| 추천 | 마음에 드는 글에 추천(좋아요) |
| 소셜 공유 | Twitter / Facebook / 링크 복사 |
| RSS 피드 | `/blog/:username/feed.xml` 구독 지원 |
| 블로그 통계 | 조회수 · 댓글 · 팔로워 현황 차트 |

### 🎨 블로그 개인화

| 기능 | 설명 |
|------|------|
| 스킨 | Notion / Forest / Ocean / Rose 4종 |
| 레이아웃 | 기본형 / 콤팩트 / 매거진 / 포토그래피 4종 |
| 프로필 | 소개글 · 프로필 사진 · 배너 이미지 |
| SNS 링크 | GitHub · Twitter · LinkedIn 등 연결 |
| 블로그 색상 | 대표 색상 직접 지정 |
| 다크 모드 | 라이트 / 다크 토글 |

### 🔧 관리자(Admin) 기능

| 기능 | 설명 |
|------|------|
| 포스트 관리 | 전체 회원 글 검색 · 상태 필터 · 삭제 |
| 회원 관리 | 권한 변경 (admin / editor) · 비활성화 · 삭제 |
| 댓글 관리 | 게스트 댓글 승인 / 스팸 처리 |
| 사이트 설정 | 사이트명 · 스킨 · 기타 전역 설정 |
| 통계 조회 | 특정 회원의 조회수 · 팔로워 분석 |
| 미디어 관리 | 업로드된 이미지 목록 확인 |

---

## 🚀 빠른 시작 (설치)

> **사전 준비:** [Docker](https://docs.docker.com/get-docker/) 설치 필요 (Docker Desktop 추천)

### 1단계 — 소스 코드 다운로드

```bash
git clone https://github.com/funny419/cms.git
cd cms
```

### 2단계 — 환경변수 파일 생성

프로젝트 폴더에 `.env` 파일을 만들고 아래 내용을 붙여넣으세요.
비밀번호는 반드시 본인만의 값으로 변경하세요.

```env
CMS_MARIADB_PASSWORD=강력한_루트_비밀번호
CMS_DB_APP_PASSWORD=강력한_앱_비밀번호
SECRET_KEY=무작위_비밀_키_32자_이상
JWT_SECRET_KEY=무작위_JWT_키_32자_이상
```

### 3단계 — 컨테이너 시작

```bash
docker compose up -d --build
```

최초 실행은 이미지 다운로드로 수 분이 걸릴 수 있습니다.

### 4단계 — Setup Wizard로 초기 설정

브라우저에서 **http://localhost:5173** 접속 → 자동으로 설치 마법사로 이동합니다.

| 마법사 단계 | 내용 |
|------------|------|
| 1️⃣ DB 연결 | 데이터베이스 연결 정보 입력 및 테스트 |
| 2️⃣ 백엔드 재시작 | 설정 적용을 위한 재시작 안내 |
| 3️⃣ 마이그레이션 | 테이블 자동 생성 |
| 4️⃣ 관리자 계정 | 관리자 아이디 / 이메일 / 비밀번호 설정 |
| 5️⃣ 완료 | 로그인 후 사용 시작 |

> 📖 자세한 설치 방법과 트러블슈팅은 **[설치 가이드](docs/INSTALL.md)** 를 참고하세요.

---

## 🛠 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | React 19 + Vite |
| 백엔드 | Python 3.11 + Flask |
| 데이터베이스 | MariaDB 10.11 |
| 인프라 | Docker + Docker Compose |
| 인증 | JWT (Flask-JWT-Extended) |
| 프로덕션 서버 | Gunicorn (4 workers) + Nginx |

---

## 🖥 운영 방안

### 프로덕션 서버 배포

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

GitHub Actions CI/CD를 사용하면 `main` 브랜치에 push할 때 자동으로 배포됩니다.

### 업데이트

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

### 데이터 백업

MariaDB 데이터는 Docker named volume(`db_data`)에 보관됩니다.

```bash
# 백업
docker exec cms_db mysqldump -u root -p<비밀번호> cmsdb > backup.sql

# 복구
docker exec -i cms_db mysql -u root -p<비밀번호> cmsdb < backup.sql
```

---

## 🤝 기여 방법

1. 이 저장소를 Fork합니다.
2. 새 브랜치를 만들고 변경사항을 커밋합니다.
3. Pull Request를 열어주세요.

버그 리포트나 기능 제안은 [Issues](https://github.com/funny419/cms/issues)에 남겨주세요.

---

## 📄 라이선스

MIT License — 자유롭게 사용, 수정, 배포할 수 있습니다.
