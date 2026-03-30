## ⚠️ 브랜치별 작업 환경 규칙

**반드시 현재 브랜치를 확인하고 올바른 환경에 접속할 것.**

| 브랜치 | Docker 환경 | 설명 |
|--------|------------|------|
| `dev` | **로컬 Mac Docker** | `docker compose exec ...` 사용 |
| `main` | **리모트 Windows Docker** | 서버에서 직접 실행하거나 SSH 접속 |

- `main` 브랜치에서 `docker compose exec backend ...` 실행 → **로컬 dev 환경에 접속하는 것** → 잘못된 접근
- `main` 브랜치 관련 DB/마이그레이션 작업 → **Windows 서버에서 `docker exec cms_backend_prod ...` 실행**

---

## 개발 환경 명령어

### dev 브랜치 (로컬 Mac Docker)
```bash
docker compose up -d --build   # 최초 시작 또는 패키지 변경 후 재빌드
docker compose up -d            # 일반 재시작 (컨테이너 시작 시 npm install 자동 실행)
docker compose watch            # 파일 변경 자동 반영 (권장)
docker compose down             # 중지
docker compose restart backend  # 백엔드만 재시작
docker compose logs -f          # 로그
docker compose exec db mariadb -u funnycms -p  # DB 접속
```

> **프론트엔드 패키지 관련:** `docker compose up -d`만으로도 `npm install`이 자동 실행되어 새 패키지가 반영됨. 이미지 재빌드(`--build`) 불필요.

**DB 마이그레이션 (schema.py 수정 후):**
```bash
docker compose exec backend flask db migrate -m "변경 내용"
# 앱 재시작 시 flask db upgrade 자동 실행됨 (app.py에 설정)
# 마이그레이션 파일은 반드시 git 커밋할 것
```

### pre-commit 훅 (코드 품질 자동 검증)

**최초 설치 (클론 후 1회):**
```bash
bash scripts/setup-hooks.sh
```

**검증 파이프라인 (git commit 시 자동 실행):**
```
① ruff lint + auto-fix  →  ② mypy type check  →  ③ pytest  →  ④ eslint (JS 변경 시, staged files only)
```

- `.py` 파일이 스테이징되면 ruff → mypy → pytest 순서로 실행
- `.js/.jsx` 파일이 스테이징되면 eslint 실행 (staged files만, 컨테이너 내부 경로 `/app` 기준)
  - 경로 변환: `frontend/src/foo.js` → `src/foo.js` (sed로 처리)
- ruff는 자동 수정 후 변경 파일을 자동 재스테이징
- Docker 컨테이너가 꺼져 있으면 해당 검사를 건너뜀

**pytest 테스트 환경:**
- `backend/tests/` 디렉토리에 모든 테스트 파일 위치 (14개 테스트)
- `backend/conftest.py`: pytest 플러그인 설정 (TestConfig, _db fixture)
- `TestConfig`: SQLite in-memory DB, `TESTING=True` (마이그레이션 스킵)
- 테스트 DB 초기화: `_db.create_all()` 사용 (Flask-Migrate 대신)
- 실행: `docker compose exec backend pytest -v`

**수동 실행:**
```bash
bash scripts/pre-commit.sh
```

**백엔드 주요 패키지:**
- `python-slugify`: 카테고리/태그 이름 → URL-safe slug 자동 생성
  - 사용 예: `Category(name='Django 튜토리얼')` → `slug='django-tutorial'`
  - 한글 지원: `from slugify import slugify; slug = slugify('한글', language='ko')`
  - requirements.txt에 이미 추가됨

### main 브랜치 (리모트 Windows Docker)
```powershell
# 프로덕션 컨테이너에서 실행
docker exec cms_backend_prod flask db upgrade
docker exec cms_backend_prod flask db stamp head
docker exec cms_db_prod mariadb -u funnycms -p<PASSWORD> cmsdb -e "SQL"
docker logs cms_backend_prod --tail=30
docker restart cms_backend_prod
```

**프로덕션 재배포:**
```bash
docker compose -f docker-compose.prod.yml down --remove-orphans
docker compose -f docker-compose.prod.yml up -d --build
```
