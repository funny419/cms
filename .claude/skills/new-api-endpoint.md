---
name: new-api-endpoint
description: CMS 프로젝트에 새 Flask API 엔드포인트를 추가할 때 사용. Blueprint 패턴, 응답 포맷, 권한 데코레이터, SQLAlchemy 2.x 스타일을 강제.
---

# New API Endpoint

## 1. 파일 위치 결정

| 도메인 | 파일 |
|--------|------|
| 인증 | `backend/api/auth.py` |
| 포스트 | `backend/api/posts.py` |
| Admin | `backend/api/admin.py` |
| 댓글 | `backend/api/comments.py` |
| 미디어 | `backend/api/media.py` |
| 사이트 설정 | `backend/api/settings.py` |
| **새 도메인** | `backend/api/<domain>.py` 신규 생성 |

새 파일 생성 시 `app.py`에 Blueprint 등록 필수:
```python
from api.<domain> import <domain>_bp
app.register_blueprint(<domain>_bp)
```

## 2. 엔드포인트 기본 구조

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from api.decorators import roles_required
from api.helpers import get_pagination_params, success_response, error_response
from database import db
from models import SomeModel
from sqlalchemy import select

domain_bp = Blueprint('domain', __name__)

@domain_bp.route('/api/domain', methods=['GET'])
@jwt_required()                        # 로그인 필요 시
@roles_required('admin', 'editor')     # 역할 제한 시
def some_endpoint() -> tuple:
    user_id = int(get_jwt_identity())  # str → int 변환 필수
    # ...
    return success_response(result, 200)
```

## 3. 응답 포맷 (반드시 준수)

**신규 엔드포인트는 반드시 `success_response` / `error_response` 헬퍼 사용.**
기존 핸들러는 현행 유지(소급 적용 없음).

```python
from api.helpers import success_response, error_response

# 성공
return success_response({"items": items, "total": total}, 200)
return success_response({}, 201)

# 실패
return error_response("메시지", 400)
return error_response("Forbidden", 403)
return error_response("Not found", 404)
return error_response("An internal error occurred.", 500)
```

## 4. SQLAlchemy 2.x 스타일 (1.x 금지)

```python
# 단건 조회
item = db.session.get(SomeModel, item_id)

# 조건 조회
stmt = select(SomeModel).where(SomeModel.active == True)
item = db.session.execute(stmt).scalar_one_or_none()

# 목록 + 페이지네이션 — helpers.py 활용 (DRY)
from api.helpers import get_pagination_params
page, per_page, offset = get_pagination_params()
stmt = select(SomeModel).order_by(SomeModel.created_at.desc())
stmt = stmt.offset(offset).limit(per_page)
items = db.session.execute(stmt).scalars().all()
```

## 5. 소유권 검사 패턴

```python
claims = get_jwt()
role = claims.get('role')

if role != 'admin' and item.author_id != user_id:
    return error_response("Forbidden", 403)
```

## 6. Import 주의

Docker 빌드 시 `backend/` → `/app` 루트로 복사됨. `backend.` 접두사 사용 금지:
```python
from api.decorators import roles_required   # ✅
from backend.api.decorators import ...      # ❌
```

모델 import 경로 (Issue #21 이후):
```python
from models import Post, User, Comment     # ✅ (models/__init__.py re-export)
from models.schema import Post, User       # ❌ (구 경로, 사용 금지)
```

## 7. SOLID/DRY 가이드 (BE)

### helpers.py 활용 (DRY)

`backend/api/helpers.py`에 공통 헬퍼 함수가 있습니다. 직접 구현하지 말고 활용하세요:

```python
from api.helpers import get_pagination_params, success_response, error_response, verify_guest_auth

# 페이지네이션 파라미터 추출 (7개 함수에서 중복 제거)
page, per_page, offset = get_pagination_params()

# 응답 포맷 통일
return success_response({"items": items, "total": total}, 200)
return error_response("Not found", 404)

# 게스트 댓글 인증 (None=성공, tuple=실패)
err = verify_guest_auth(comment, data)
if err:
    return err
```

### SRP — 핸들러 책임 분리

핸들러 함수가 100줄을 초과하면 내부 헬퍼 함수로 분해를 검토하세요:
```python
# ❌ 핸들러가 모든 것을 담당
def get_post(post_id):
    # 200줄: 인증 + 접근제어 + view_count + 집계 + 시리즈 + 응답

# ✅ 책임 분리
def _record_visit(post, request, user_id): ...
def _get_post_aggregates(post_id): ...
def _build_series_info(post_id): ...
def get_post(post_id):
    # 핵심 흐름만 남김
```

### OCP — 필터/확장 포인트 분리

새 필터 추가 시 기존 함수 내부를 수정하는 대신 별도 함수로 분리하세요:
```python
# ❌ 새 필터마다 함수 내부 수정
def list_items():
    if q: ...
    if category_id: ...
    if new_filter: ...  # 함수 수정 필요

# ✅ 필터 함수 분리
def _apply_search_filter(query, q): ...
def _apply_category_filter(query, category_id): ...
```

## 8. 완료 체크리스트

- [ ] **신규 엔드포인트**: `success_response()` / `error_response()` 사용 필수 (기존 핸들러 소급 적용 없음)
- [ ] 모든 함수에 타입 힌트 (`-> tuple`)
- [ ] SQLAlchemy 2.x 스타일 (`select()`, `scalar_one_or_none()`)
- [ ] JWT identity `int()` 변환
- [ ] 권한 없는 요청 시 적절한 HTTP 상태 코드
- [ ] 새 Blueprint면 `app.py`에 등록
- [ ] 모델 import 경로: `from models import X` (구 경로 `from models.schema import X` 금지)
- [ ] 페이지네이션 직접 구현 대신 `get_pagination_params()` 활용
- [ ] 새 패키지 추가 시 `requirements.txt` 반영 + `--no-cache` 재빌드
- [ ] `api.md`에 엔드포인트 추가
