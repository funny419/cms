## CI/CD (GitHub Actions — Windows Self-Hosted Runner)

**필요한 GitHub Secrets:**
```
CMS_MARIADB_PASSWORD   # MariaDB root 패스워드
CMS_DB_APP_PASSWORD    # DB 앱 유저 패스워드
FLASK_SECRET_KEY       # .env의 SECRET_KEY로 매핑됨
JWT_SECRET_KEY         # JWT 서명 키
DISCORD_WEBHOOK_URL    # 배포 알림 Discord 웹훅 URL
```

**인코딩 규칙 (PowerShell):**
- `.env` 생성 시 반드시 **UTF-8 No BOM** 사용 → `[System.IO.File]::WriteAllText(..., UTF8Encoding($false))`
- Discord Webhook JSON 페이로드의 한글 문자열은 **`env:` 섹션으로 분리** 후 `$env:VAR_NAME` 호출 → `UTF8Encoding($false)`로 바이너리 전송
  - (단순 `Write-Host` 로깅 메시지의 한글은 허용 — 인코딩 이슈 없음)

**배포 흐름:**
1. `.env` 파일 동적 생성 (Secrets 조합)
2. `docker compose -f docker-compose.prod.yml down --remove-orphans`
3. `docker compose -f docker-compose.prod.yml up -d --build`
4. 30초 대기 후 비정상 컨테이너 확인
5. Discord 성공/실패 알림
6. `.env` 파일 삭제 (`always()` 조건)
