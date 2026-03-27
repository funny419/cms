---
name: deploy
description: dev → main PR 생성, GitHub Actions CI/CD 결과 확인, 프로덕션 마이그레이션까지 전체 배포 흐름 가이드.
---

# Deploy

## 배포 전 체크리스트

- [ ] `dev` 브랜치에서 작업 완료 및 로컬 테스트 통과
- [ ] 마이그레이션 파일이 있으면 `git commit`에 포함됨
- [ ] `requirements.txt` 변경 사항 반영됨
- [ ] `.env` 변경 필요 시 GitHub Secrets 업데이트 완료

---

## 1. dev → main PR 생성

```bash
# 현재 브랜치 확인
git branch   # dev 여야 함

# PR 생성
gh pr create --base main --head dev \
  --title "feat: 기능명" \
  --body "## 변경 내용
- 항목1
- 항목2

## 테스트
- [ ] 로컬 dev 환경 테스트 완료
- [ ] 마이그레이션 파일 포함"
```

---

## 2. CI/CD 결과 확인

```bash
# 최근 워크플로 실행 목록
gh run list --limit 5

# 특정 실행 상태 확인
gh run view <run-id>

# 실시간 로그
gh run watch <run-id>
```

### 배포 흐름 (GitHub Actions)
```
main push/merge
  → .env 생성 (Secrets 조합)
  → docker compose -f docker-compose.prod.yml down --remove-orphans
  → docker compose -f docker-compose.prod.yml up -d --build
  → 30초 대기
  → 비정상 컨테이너 확인
  → Discord 알림 (성공/실패)
  → .env 삭제
```

---

## 3. 프로덕션 마이그레이션 확인

배포 후 백엔드 시작 시 `flask db upgrade` 자동 실행.
문제 발생 시 Windows 서버에서 직접:

```powershell
# 로그 확인
docker logs cms_backend_prod --tail=30

# 수동 upgrade
docker exec cms_backend_prod flask db upgrade

# 마이그레이션 상태 확인
docker exec cms_db_prod mariadb -u funnycms -p<PASSWORD> cmsdb -e "SELECT * FROM alembic_version"
```

---

## 4. 배포 실패 시

### 컨테이너가 Exited 상태
```powershell
docker logs cms_backend_prod --tail=50
# ImportError → app.py 팩토리 문법 확인
# Migration 오류 → 위 트러블슈팅 참조
```

### 전체 재배포 (프로덕션)
```powershell
docker compose -f docker-compose.prod.yml down --remove-orphans
docker compose -f docker-compose.prod.yml up -d --build
```

### 롤백
```bash
# 이전 커밋으로 main 되돌리기 (신중하게)
git revert <commit-hash>
git push origin main
# → CI/CD 재트리거
```

---

## 5. 배포 후 확인

- [ ] Discord 알림 성공 메시지 수신
- [ ] 프로덕션 URL 접속 정상
- [ ] 로그인/포스트 조회 동작 확인
- [ ] 마이그레이션이 있었으면 새 컬럼/테이블 정상 확인
