## CI/CD (GitHub Actions — Ubuntu Self-Hosted Runner)

> **2026-04-16 전환:** Windows PowerShell → Ubuntu bash 전면 재작성 (커밋: 69579f3)
> `runs-on: windows` → `runs-on: linux`. 모든 shell: powershell 제거 (기본값 bash).

**필요한 GitHub Secrets:**
```
CMS_MARIADB_PASSWORD   # MariaDB root 패스워드
CMS_DB_APP_PASSWORD    # DB 앱 유저 패스워드
FLASK_SECRET_KEY       # .env의 SECRET_KEY로 매핑됨
JWT_SECRET_KEY         # JWT 서명 키
DISCORD_WEBHOOK_URL    # 배포 알림 Discord 웹훅 URL (env: 섹션으로 분리 — 보안)
```

**bash 환경 주요 변경 사항:**
- `.env` 생성: `WriteAllText` → `printf` (bash 기본 UTF-8, BOM 없음)
- 컨테이너 상태 확인: `Start-Sleep` → `sleep`, `$exited` → `exited=$(...) + [ -n ]`
- 롤백: `-not $env:PREV_SHA` → `[ -z "$PREV_SHA" ]`, `Add-Content` → `echo >> $GITHUB_ENV`
- Discord 알림: `Invoke-WebRequest` → `curl -X POST`
- Clean up: `Remove-Item` → `rm -f`

**배포 흐름:**
1. `.env` 파일 동적 생성 (Secrets 조합)
2. `docker compose -f docker-compose.prod.yml down --remove-orphans`
3. `docker compose -f docker-compose.prod.yml up -d --build`
4. 30초 대기 후 비정상 컨테이너 확인
5. **배포 실패 시 자동 롤백** (#54): `github.event.before` SHA로 git checkout 후 재빌드. `ROLLBACK_DONE` env 변수로 Discord 알림 메시지 분기
6. Discord 성공/실패 알림 (롤백 완료 여부 포함)
7. `.env` 파일 삭제 (`always()` 조건)

**Docker 인프라 설정 (프로덕션):**
- **backend 컨테이너 healthcheck** (#38): `curl -f http://localhost:5000/health`. start_period=40s (Gunicorn 기동 고려), nginx depends_on `service_healthy` 조건
- **로그 rotation** (#39): db/backend/nginx 3개 서비스에 json-file driver, max-size 100m, max-file 5 (`docker-compose.prod.yml`)
- **개발 환경 healthcheck** (#38): Flask dev server 기준 start_period=20s (`docker-compose.yml`)

**보안 (Dockerfile):**
- **비권한 USER** (appuser): `adduser + chown -R appuser /app` 후 `USER appuser` 적용 (dev/prod 공통). root에서 컨테이너 프로세스 분리
- **appuser 레이어 순서 최적화** (커밋: 2ef8727): `adduser`를 `COPY requirements.txt` 이전으로 이동 → 코드 변경 시 사용자 생성 레이어 캐시 재사용 가능. `adduser`와 `chown` 단계 분리로 역할 명확화
