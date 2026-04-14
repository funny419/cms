---
name: db-migration
description: 모델 파일 수정 후 Flask-Migrate 마이그레이션 파일 생성 및 적용 워크플로. 마이그레이션 파일 커밋 누락 방지.
---

# DB Migration

## 모델 파일 구조 (Issue #21 이후)

모델은 `backend/models/` 디렉토리에 도메인별로 분리되어 있음:

```
backend/models/
├── base.py        # Base(DeclarativeBase)만 — 다른 models 임포트 금지
├── user.py        # User, Follow
├── post.py        # Post, PostMeta, PostLike, VisitLog
├── comment.py     # Comment
├── media.py       # Media
├── category.py    # Category
├── tag.py         # Tag, PostTag
├── series.py      # Series, SeriesPost
├── option.py      # Option, Menu, MenuItem
├── constants.py   # MAX_CATEGORY_DEPTH 등 도메인 상수
└── __init__.py    # 전체 모델 re-export (Alembic 자동 감지 필수)
```

### 신규 모델 추가 시 필수 절차

1. `models/<domain>.py` 파일에 모델 클래스 작성
2. **`models/__init__.py`에 re-export 반드시 추가** — 누락 시 Alembic이 해당 테이블을 DROP으로 인식 → 데이터 소실 위험
3. import는 `from models import X` 사용 (`from models.schema import X` 구문 사용 금지 — 삭제됨)
4. 도메인 상수(MAX_DEPTH 등)는 `models/constants.py`에 추가

## 작업 순서

### 1. 모델 파일 수정
해당 도메인 파일(`backend/models/<domain>.py`)에서 모델 변경 (컬럼 추가/수정/삭제, 테이블 추가 등)

### 2. 마이그레이션 파일 생성
```bash
docker compose exec backend flask db migrate -m "변경 내용 설명"
```

생성된 파일: `backend/migrations/versions/xxxx_변경내용.py`

### 3. 생성된 파일 반드시 검토

자동 생성 파일이 의도한 변경만 담고 있는지 확인:
- `upgrade()` 함수: 추가/변경 내용 확인
- `downgrade()` 함수: 롤백 내용 확인
- 불필요한 변경이 포함됐으면 수동으로 제거

흔한 문제: Alembic이 탐지 못하는 변경 (컬럼 타입 변경, 인덱스 변경) → 수동 추가 필요

### 4. git 커밋 (필수!)

```bash
git add backend/migrations/versions/xxxx_변경내용.py
git add backend/models/<domain>.py  # 변경한 도메인 파일
git add backend/models/__init__.py   # 신규 모델 추가 시 반드시 포함
git commit -m "feat: <변경 내용> 마이그레이션 추가"
```

**마이그레이션 파일 미커밋 시 프로덕션 배포 시 오류 발생**

### 5. 적용 확인

앱 재시작 시 `flask db upgrade` 자동 실행 (`app.py`에 설정됨):
```bash
docker compose restart backend
docker compose logs backend --tail=20  # "Running upgrade" 로그 확인
```

## 트러블슈팅

### Table already exists
```bash
docker compose exec backend flask db stamp head
```

### Multiple head revisions (히스토리 분기)
```bash
docker compose exec backend flask db heads  # 두 head 확인
```
merge 마이그레이션 파일 수동 생성:
```python
# down_revision = ('head1_hash', 'head2_hash')
def upgrade(): pass
def downgrade(): pass
```

### Unknown column (프로덕션 DB에 컬럼 누락)
```powershell
# Windows 서버에서 직접 실행
docker exec cms_db_prod mariadb -u funnycms -p<PASSWORD> cmsdb -e "ALTER TABLE <table> ADD COLUMN IF NOT EXISTS <col> <type>"
docker exec cms_backend_prod flask db stamp head
```

### Can't locate revision
DB의 `alembic_version`이 존재하지 않는 해시 참조 → 서버에서 직접 수정:
```powershell
docker exec cms_db_prod mariadb -u funnycms -p<PASSWORD> cmsdb -e "UPDATE alembic_version SET version_num='<올바른hash>'"
```

## 완료 체크리스트

- [ ] `models/<domain>.py` 변경 내용 의도한 것만 포함
- [ ] 신규 모델 추가 시 `models/__init__.py` re-export 추가됨
- [ ] 생성된 마이그레이션 파일 내용 검토
- [ ] `git commit`에 마이그레이션 파일 포함
- [ ] `docker compose restart backend` 후 오류 없음
- [ ] 로그에서 upgrade 성공 확인
