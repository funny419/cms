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
from database import db
from models.schema import SomeModel
from sqlalchemy import select

domain_bp = Blueprint('domain', __name__)

@domain_bp.route('/api/domain', methods=['GET'])
@jwt_required()                        # 로그인 필요 시
@roles_required('admin', 'editor')     # 역할 제한 시
def some_endpoint() -> tuple:
    user_id = int(get_jwt_identity())  # str → int 변환 필수
    # ...
    return jsonify({"success": True, "data": result, "error": None}), 200
```

## 3. 응답 포맷 (반드시 준수)

```python
# 성공
return jsonify({"success": True, "data": {...}, "error": None}), 200

# 실패
return jsonify({"success": False, "data": None, "error": "메시지"}), 400
return jsonify({"success": False, "data": None, "error": "Forbidden"}), 403
return jsonify({"success": False, "data": None, "error": "Not found"}), 404
```

## 4. SQLAlchemy 2.x 스타일 (1.x 금지)

```python
# 단건 조회
item = db.session.get(SomeModel, item_id)

# 조건 조회
stmt = select(SomeModel).where(SomeModel.active == True)
item = db.session.execute(stmt).scalar_one_or_none()

# 목록 + 페이지네이션
page = request.args.get('page', 1, type=int)
per_page = request.args.get('per_page', 20, type=int)
stmt = select(SomeModel).order_by(SomeModel.created_at.desc())
stmt = stmt.offset((page - 1) * per_page).limit(per_page)
items = db.session.execute(stmt).scalars().all()
```

## 5. 소유권 검사 패턴

```python
claims = get_jwt()
role = claims.get('role')

if role != 'admin' and item.author_id != user_id:
    return jsonify({"success": False, "data": None, "error": "Forbidden"}), 403
```

## 6. Import 주의

Docker 빌드 시 `backend/` → `/app` 루트로 복사됨. `backend.` 접두사 사용 금지:
```python
from api.decorators import roles_required   # ✅
from backend.api.decorators import ...      # ❌
```

## 7. 완료 체크리스트

- [ ] 응답 포맷이 `{ success, data, error }` 형태
- [ ] 모든 함수에 타입 힌트 (`-> tuple`)
- [ ] SQLAlchemy 2.x 스타일 (`select()`, `scalar_one_or_none()`)
- [ ] JWT identity `int()` 변환
- [ ] 권한 없는 요청 시 적절한 HTTP 상태 코드
- [ ] 새 Blueprint면 `app.py`에 등록
- [ ] 새 패키지 추가 시 `requirements.txt` 반영 + `--no-cache` 재빌드
- [ ] `api.md`에 엔드포인트 추가
