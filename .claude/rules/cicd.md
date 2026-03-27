## CI/CD (GitHub Actions — Windows Self-Hosted Runner)

**인코딩 규칙 (PowerShell):**
- `.env` 생성 시 반드시 **UTF-8 No BOM** 사용 → `[System.IO.File]::WriteAllText(..., UTF8Encoding($false))`
- 스크립트 본문(run 섹션)에 **한글 직접 작성 금지** → `env:` 섹션으로 환경변수 전달 후 `$env:VAR_NAME` 호출
- Discord Webhook JSON 페이로드: `UTF8Encoding($false)`로 바이너리 전송

**배포 흐름:**
1. `.env` 파일 동적 생성 (Secrets 조합)
2. `docker compose -f docker-compose.prod.yml down --remove-orphans`
3. `docker compose -f docker-compose.prod.yml up -d --build`
4. 30초 대기 후 비정상 컨테이너 확인
5. Discord 성공/실패 알림
6. `.env` 파일 삭제 (`always()` 조건)
