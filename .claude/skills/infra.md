---
name: infra
description: Docker Compose, GitHub Actions, Nginx 설정 변경 시 사용. 인코딩 규칙, 배포 흐름, 서비스 추가 체크리스트.
---

# Infra

## Docker Compose 변경 시

### 새 서비스 추가 체크리스트
- [ ] 서비스명 명명 규칙: `cms_<role>` (개발), `cms_<role>_prod` (프로덕션)
- [ ] 개발(`docker-compose.yml`)과 프로덕션(`docker-compose.prod.yml`) 둘 다 고려
- [ ] 포트: 외부 노출 필요한지 판단 (내부 통신만이면 `expose` 사용)
- [ ] 볼륨: named volume(프로덕션) vs bind mount(개발) 구분
- [ ] `depends_on`: 의존 서비스 명시
- [ ] 헬스체크: 오래 걸리는 서비스(DB 등)에 `healthcheck` 추가

### 개발 환경 서비스 구성
```yaml
services:
  backend:
    container_name: cms_backend
    build: ./backend
    volumes:
      - ./backend:/app           # 코드 핫리로드
      - ./backend/uploads:/app/uploads
    environment:
      - FLASK_ENV=development

  frontend:
    container_name: cms_frontend
    command: sh -c "npm install && npm run dev"   # 시작 시 자동 install

  nginx-files:
    container_name: cms_nginx_files
    image: nginx:alpine
    volumes:
      - ./backend/uploads:/usr/share/nginx/html/uploads:ro
      - ./nginx/nginx-files.conf:/etc/nginx/conf.d/default.conf:ro
```

### 프로덕션 추가 고려사항
- `restart: unless-stopped` 모든 서비스에 적용
- `uploads_data` named volume: backend와 nginx 양쪽에서 마운트
- Gunicorn: `cms_backend_prod` 에서 `gunicorn -w 4 "app:create_app()"`

---

## GitHub Actions (CI/CD) 변경 시

### 인코딩 규칙 (PowerShell)
- `.env` 생성: **UTF-8 No BOM** 필수
  ```powershell
  [System.IO.File]::WriteAllText($envPath, $content, [System.Text.UTF8Encoding]::new($false))
  ```
- `run:` 섹션에 **한글 직접 작성 금지** — `env:` 변수로 우회
  ```yaml
  env:
    MSG_SUCCESS: "배포 성공"   # ❌ run: 내부에서 한글 직접 사용 금지
  steps:
    - run: Write-Host $env:MSG_SUCCESS  # ✅
  ```
- Discord Webhook: `UTF8Encoding($false)` 바이너리 전송

### 시크릿 추가 시
1. GitHub → Settings → Secrets and variables → Actions → New repository secret
2. `deploy.yml`의 `env:` 또는 `with:` 섹션에 `${{ secrets.NEW_SECRET }}` 추가
3. `.env` 생성 스크립트에 반영

### 배포 흐름 확인
```
main push
→ .env 생성 (Secrets 조합)
→ docker compose -f docker-compose.prod.yml down --remove-orphans
→ docker compose -f docker-compose.prod.yml up -d --build
→ 30초 대기
→ 비정상 컨테이너 확인
→ Discord 알림
→ .env 삭제 (always)
```

---

## Nginx 설정 변경 시

### 개발용 파일 서버 (`nginx/nginx-files.conf`)
```nginx
server {
    listen 80;
    location /uploads/ {
        alias /usr/share/nginx/html/uploads/;
        # 경로 변경 시 docker-compose.yml 볼륨 마운트도 함께 수정
    }
}
```

### 프로덕션 Nginx
- `docker-compose.prod.yml`의 nginx 서비스 설정 확인
- `/uploads/` → `uploads_data` 볼륨 직접 서빙

---

## 완료 체크리스트

- [ ] 개발/프로덕션 compose 파일 모두 수정
- [ ] 새 환경변수는 GitHub Secrets에 추가
- [ ] CI/CD 스크립트 한글 직접 사용 없음
- [ ] `.env` 생성 시 UTF-8 No BOM
- [ ] 새 포트가 있으면 방화벽/보안그룹 개방 여부 확인
- [ ] `docker compose config` 로 YAML 문법 오류 확인
