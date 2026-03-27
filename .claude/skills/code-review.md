---
name: code-review
description: CMS 프로젝트 코드 리뷰 시 사용. 프로젝트 고유 규칙(Tailwind 금지, fetch 금지, SQLAlchemy 2.x, 응답 포맷 등)을 체크리스트로 검증.
---

# Code Review

리뷰 대상 파일을 읽은 후, 아래 체크리스트 순서로 검토한다.

## Backend (Python/Flask)

### 필수 규칙

- [ ] **응답 포맷**: 모든 엔드포인트가 `{ "success": bool, "data": {}, "error": str }` 형태
- [ ] **타입 힌트**: 모든 함수에 파라미터/반환 타입 힌트 존재
- [ ] **SQLAlchemy 버전**: 1.x 스타일(`Model.query.filter_by`) 사용 금지, 2.x 스타일(`select()`, `scalar_one_or_none()`) 사용
- [ ] **JWT identity**: `create_access_token(identity=str(user.id))` — 문자열이어야 함
  - 조회 시 `int(get_jwt_identity())` 변환 확인
- [ ] **Import 경로**: `backend.` 접두사 없음 (Docker 환경에서 `/app` 루트로 복사됨)
- [ ] **Blueprint 패턴**: 도메인별 파일 분리, 단일 파일에 너무 많은 도메인 혼재 금지

### 권한 & 보안

- [ ] **소유권 검사**: `PUT`/`DELETE`에서 `admin` 외 사용자가 타인 리소스 수정 가능한지 확인
  ```python
  if role != 'admin' and item.author_id != user_id:
      return jsonify({"success": False, ...}), 403
  ```
- [ ] **roles_required**: 보호가 필요한 엔드포인트에 데코레이터 적용 여부
- [ ] **입력 검증**: 외부 입력(`request.json`, `request.args`)에 타입/존재 검증

### 코드 품질

- [ ] **불필요한 추상화**: 1회성 코드에 불필요한 클래스/함수 래핑 없음
- [ ] **에러 처리**: 불가능한 시나리오에 대한 방어 코드 없음 (내부 코드는 신뢰)
- [ ] **새 패키지**: `requirements.txt` 반영 여부

---

## Frontend (React/JSX)

### 필수 규칙

- [ ] **Tailwind 금지**: `className`에 Tailwind 클래스(`text-gray-500`, `flex`, `p-4` 등) 없음
- [ ] **fetch 금지**: `fetch(...)` 사용 없음, axios만 사용
- [ ] **CSS Variables**: 인라인 스타일 또는 유틸리티 클래스에서 `var(--text)`, `var(--bg)` 등 사용
- [ ] **axios import**: `import axios from 'axios'` (axios 없이 직접 fetch 금지)

### 권한 & 상태

- [ ] **권한 확인**: 로그인 필요 페이지에서 `getUser()` 패턴 사용, 없으면 리다이렉트
  ```js
  const getUser = () => {
    try { return JSON.parse(localStorage.getItem('user')); }
    catch { return null; }
  };
  ```
- [ ] **role 분기**: admin 전용 페이지에서 `user.role !== 'admin'` 체크

### 코드 품질

- [ ] **API 클라이언트 분리**: API 호출이 페이지 컴포넌트에 직접 섞이지 않고 `src/api/`에 분리
- [ ] **에러 상태 처리**: `try/catch` + 사용자에게 에러 표시
- [ ] **로딩 상태**: 비동기 요청 중 로딩 표시
- [ ] **다크모드**: 하드코딩된 색상 없이 CSS Variables만 사용 (자동으로 다크모드 대응)

---

## 공통

- [ ] **CLAUDE.md 규칙**: Simplicity First — 요청한 것 외의 추가 기능/추상화 없음
- [ ] **Surgical Changes**: 요청 범위 밖의 코드를 건드리지 않음
- [ ] **주석**: 자명한 코드에 불필요한 주석 없음

---

## 리뷰 결과 형식

```
## 리뷰 결과

### 필수 수정
- (수정하지 않으면 버그/보안 문제)

### 권장 수정
- (코드 품질, 규칙 위반)

### 확인 필요
- (의도가 불분명하여 확인 필요한 사항)

### 통과
- 전반적으로 규칙 준수 여부
```
