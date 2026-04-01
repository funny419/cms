# CMS 설치 가이드

이 문서는 CMS를 새 서버(또는 로컬)에 처음 설치하는 방법을 안내합니다.
설치 완료 후 브라우저 Setup Wizard에서 관리자 계정과 사이트 기본 설정을 마무리합니다.

---

## 사전 요구사항

| 도구 | 최소 버전 | 설치 확인 명령어 |
|------|---------|---------------|
| Docker | 24.x 이상 | `docker --version` |
| Docker Compose | v2.x (플러그인) | `docker compose version` |
| Git | 2.x 이상 | `git --version` |

> **Windows 사용자:** Docker Desktop을 설치하면 Docker + Docker Compose가 함께 제공됩니다.

---

## Step 1. 소스 코드 다운로드

```bash
git clone https://github.com/funny419/cms.git
cd cms
```

---

## Step 2. 환경변수 파일 생성

프로젝트 루트에 `.env` 파일을 생성합니다.

```bash
cp .env.example .env   # 예시 파일이 있는 경우
# 또는 아래 내용을 직접 작성
```

`.env` 파일 내용 (필수 항목):

```env
# Database
CMS_MARIADB_PASSWORD=your_mariadb_root_password
CMS_DB_APP_PASSWORD=your_app_db_password
CMS_DB_USER=funnycms
CMS_DB_NAME=cmsdb

# Security — 반드시 무작위 문자열로 변경할 것
SECRET_KEY=change-this-to-a-random-secret-key
JWT_SECRET_KEY=change-this-to-a-random-jwt-key
```

> **보안 주의:** 프로덕션 환경에서는 `SECRET_KEY`와 `JWT_SECRET_KEY`를 반드시 강력한 무작위 문자열로 설정하세요.
> 생성 예시: `python3 -c "import secrets; print(secrets.token_hex(32))"`

---

## Step 3. Docker 컨테이너 시작

```bash
docker compose up -d --build
```

최초 실행 시 이미지 빌드로 수 분이 소요될 수 있습니다. 진행 상황을 보려면:

```bash
docker compose logs -f
```

모든 컨테이너가 정상 기동되었는지 확인합니다:

```bash
docker compose ps
```

`cms_db`, `cms_backend`, `cms_frontend`, `cms_nginx_files` 4개 컨테이너가 `running` 상태이어야 합니다.

---

## Step 4. Setup Wizard 실행

브라우저에서 아래 주소로 접속합니다:

```
http://localhost:5173
```

앱이 자동으로 `/wizard` 페이지로 리다이렉트됩니다.
다음 4단계를 순서대로 완료합니다:

| 단계 | 내용 |
|------|------|
| Step 1 | DB 연결 상태 확인 |
| Step 2 | 관리자 계정 생성 (username / email / password) |
| Step 3 | 사이트 기본 설정 (사이트명 / URL / 태그라인) |
| Step 4 | 설치 완료 → 로그인 페이지 이동 |

완료 후 생성한 관리자 계정으로 로그인하면 CMS를 사용할 수 있습니다.

---

## 프로덕션 배포 (서버에 설치 시)

프로덕션 환경에서는 `docker-compose.prod.yml`을 사용합니다.

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

> GitHub Actions CI/CD가 설정되어 있다면 `main` 브랜치 push 시 자동 배포됩니다.
> 자세한 내용은 `.github/workflows/deploy.yml` 참조.

---

## 트러블슈팅

### 컨테이너가 시작되지 않는 경우

```bash
docker compose logs backend   # 백엔드 오류 확인
docker compose logs db        # DB 오류 확인
```

### `cms_db` 컨테이너 헬스체크 실패

MariaDB 초기화에 시간이 걸릴 수 있습니다. 1-2분 후 재시도하세요:

```bash
docker compose restart
```

### `.env` 파일 누락 오류

`docker compose up` 시 `variable is not set` 오류가 나오면 `.env` 파일이 없거나 필수 변수가 누락된 것입니다. Step 2를 다시 확인하세요.

### DB 마이그레이션 오류

```bash
# 마이그레이션 상태 확인
docker compose exec backend flask db current

# 수동 업그레이드
docker compose exec backend flask db upgrade

# "Table already exists" 오류 시
docker compose exec backend flask db stamp head
```

### 브라우저에서 `/wizard`가 표시되지 않는 경우

`cms_backend` 컨테이너가 정상 실행 중인지 확인합니다:

```bash
docker compose ps cms_backend
curl http://localhost:5000/health  # {"status": "ok"} 응답 확인
```

### Setup Wizard 완료 후 다시 표시되는 경우

`.env` 파일에 `WIZARD_COMPLETED=true` 항목이 있는지 확인합니다. 없으면 admin 계정이 없는 것이므로 DB를 초기화하거나 직접 추가합니다:

```bash
echo "WIZARD_COMPLETED=true" >> .env
docker compose restart backend
```

---

## 관련 문서

- [API 엔드포인트](.claude/rules/api.md)
- [아키텍처 개요](.claude/rules/architecture.md)
- [CI/CD 설정](.claude/rules/cicd.md)
- [Setup Wizard Phase 2 구현 계획](superpowers/plans/2026-04-01-setup-wizard-phase2.md)
