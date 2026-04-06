---
name: debug
description: CMS 프로젝트 오류 발생 시 사용. 브랜치별 환경 분기 실수 방지, Docker/API/DB/FE 오류 진단 흐름.
---

# Debug

## 0. 먼저 확인: 브랜치 & 환경

```bash
git branch  # 현재 브랜치 확인
```

| 브랜치 | 올바른 명령어 | 잘못된 명령어 |
|--------|-------------|-------------|
| `dev` | `docker compose exec backend ...` | `docker exec cms_backend_prod ...` |
| `main` | `docker exec cms_backend_prod ...` (Windows 서버) | `docker compose exec ...` (로컬) |

**`main` 브랜치에서 `docker compose exec backend` 실행 = 로컬 dev 컨테이너 접속 = 잘못된 접근**

---

## 1. 백엔드 오류

### 로그 먼저 확인
```bash
docker compose logs backend --tail=50
docker compose logs backend -f  # 실시간
```

### Gunicorn 500 / ImportError
```bash
# 직접 실행으로 ImportError 확인
docker compose exec backend python app.py
```
- `app:create_app()` 팩토리 문법 확인
- Import 경로에 `backend.` 접두사 없는지 확인

### 테이블 없음 (`Table doesn't exist`)
```bash
docker compose exec backend flask db upgrade
```

### 마이그레이션 오류
| 증상 | 해결 |
|------|------|
| `Table already exists` | `flask db stamp head` |
| `Can't locate revision` | DB에서 `alembic_version` 직접 수정 |
| `Multiple head revisions` | `flask db heads` 확인 후 merge migration 생성 |
| `Unknown column` | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 후 stamp |

### JWT 오류
- `Subject must be a string` → `create_access_token(identity=str(user.id))` 확인
- 401 Unauthorized → Authorization 헤더 형식 `Bearer <token>` 확인

---

## 2. 프론트엔드 오류

### `Failed to resolve import`
```bash
docker compose build frontend --no-cache
docker compose up -d frontend
```
또는 그냥:
```bash
docker compose up -d  # 시작 시 npm install 자동 실행
```

### API 연결 실패
```bash
# vite.config.js 확인
docker compose exec frontend cat /app/vite.config.js
# BACKEND_URL 환경변수 확인
docker compose exec frontend env | grep URL
```

### 이미지 로드 실패 (`/uploads/...` 404)
```bash
docker compose ps  # nginx-files 컨테이너 실행 중인지 확인
docker compose logs nginx-files --tail=20
# vite.config.js의 FILES_URL이 http://nginx-files:80 인지 확인
```

---

## 3. DB 오류

### DB 접속 확인
```bash
docker compose exec db mariadb -u funnycms -p
# 접속 안 되면:
docker compose logs db --tail=30
docker compose restart db
```

### 개발 환경 DB 직접 쿼리
```bash
docker compose exec db mariadb -u funnycms -p cmsdb -e "SHOW TABLES;"
docker compose exec db mariadb -u funnycms -p cmsdb -e "SELECT * FROM alembic_version;"
```

---

## 4. 권한 오류

### 회원가입 후 editor 기능 접근 안 됨
DB에 직접 삽입한 계정은 기본 role이 `subscriber`일 수 있음:
```bash
docker compose exec db mariadb -u funnycms -p cmsdb -e "UPDATE users SET role='editor' WHERE username='...'"
```

### admin 대시보드 접근 불가
`localStorage`의 `user` 객체에서 `role` 확인:
```js
JSON.parse(localStorage.getItem('user'))  // 브라우저 콘솔
```

---

## 5. 개발 환경 view_count +2

React StrictMode에서 `useEffect`가 2번 실행되는 정상 동작. 프로덕션 빌드에서는 +1.

---

## 진단 순서 요약

```
오류 발생
  → 브랜치 확인 (dev/main 환경 분기)
  → 로그 확인 (docker compose logs)
  → 백엔드 직접 실행으로 ImportError 확인
  → DB 마이그레이션 상태 확인
  → troubleshooting.md 참조
```
