---
name: new-page
description: CMS 프로젝트에 새 React 페이지를 추가할 때 사용. CSS Variables 사용, axios, 권한 확인 패턴, Route 등록을 강제.
---

# New React Page

## 1. 파일 위치 결정

| 페이지 유형 | 경로 |
|------------|------|
| 공개 페이지 | `frontend/src/pages/PageName.jsx` |
| Admin 전용 | `frontend/src/pages/admin/AdminPageName.jsx` |
| 공통 컴포넌트 | `frontend/src/components/ComponentName.jsx` |
| API 클라이언트 | `frontend/src/api/domain.js` |

## 2. 페이지 기본 구조

```jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';          // ✅ 인증 정보는 useAuth 훅 사용
import { authHeader } from '../api/client';           // ✅ authHeader는 client.js에서 import
import axios from 'axios';

export default function PageName() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    // admin 전용이면: if (user.role !== 'admin') { navigate('/'); return; }

    let cancelled = false;
    const load = async () => {
      try {
        const res = await axios.get('/api/...', { headers: authHeader(token) });
        if (!cancelled) setData(res.data.data || []);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || '오류가 발생했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user, token, navigate]);

  if (loading) return <div className="empty-state">불러오는 중...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div className="page-content">
      {/* 내용 */}
    </div>
  );
}
```

## 3. 스타일 규칙 (반드시 준수)

**Tailwind 사용 금지.** CSS Variables + 유틸리티 클래스만 사용:

```jsx
// ✅ 올바른 방식
<div style={{ color: 'var(--text)', background: 'var(--bg)' }}>
<button className="btn btn-primary">
<div className="card">
<input className="form-input">
<div className="alert alert-error">
<span className="badge">

// ❌ 금지
<div className="text-gray-500 bg-white">  // Tailwind
```

주요 CSS Variables: `--text`, `--bg`, `--bg-secondary`, `--border`, `--primary`, `--primary-hover`

## 4. HTTP 요청 규칙

```jsx
// ✅ axios + api/client.js 사용
import axios from 'axios';
import { authHeader } from '../api/client';
const res = await axios.get('/api/...', { headers: authHeader(token) });

// ❌ fetch 금지
const res = await fetch('/api/...');

// ❌ localStorage 직접 접근 금지
headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
```

API 클라이언트는 `frontend/src/api/` 에 분리 필수:
```js
// frontend/src/api/domain.js
import axios from 'axios';
import { authHeader } from './client';  // ✅ authHeader는 반드시 client.js에서 import

export const getDomainData = (token) =>
  axios.get('/api/domain', { headers: authHeader(token) });
```

## 5. 테마/스킨 연동 (다크모드 대응 필요 시)

```jsx
import { useTheme } from '../context/ThemeContext';
import { useSkin } from '../context/SkinContext';

const { theme } = useTheme();   // 'light' | 'dark'
const { skin } = useSkin();     // 'notion' | 'forest' | 'ocean' | 'rose'
```

## 6. Route 등록

`frontend/src/App.jsx` (또는 라우터 파일)에 추가:
```jsx
import PageName from './pages/PageName';
// ...
<Route path="/page-path" element={<PageName />} />
```

권한별 분기가 필요하면 `PrivateRoute` 컴포넌트 활용 또는 페이지 내부에서 리다이렉트.

## 7. FE SOLID 원칙 가이드

### SRP — 데이터 페칭 로직은 Custom Hook으로 분리

페이지/컴포넌트는 **UI 렌더링만** 담당. API 호출·상태 관리·인증 확인은 훅으로 추출:

```jsx
// ✅ hooks/useMyData.js 로 분리
export function useMyData(token) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => { /* axios 호출 */ };
    load();
    return () => { cancelled = true; };
  }, [token]);

  return { data, loading };
}

// ✅ 페이지는 훅만 호출
export default function MyPage() {
  const { token, user } = useAuth();
  const { data, loading } = useMyData(token);
  // UI만 렌더링
}
```

### OCP — 새 레이아웃/변형 추가 시 LAYOUTS 맵 패턴 사용

if-chain 대신 맵 객체로 확장. **새 항목 추가 시 기존 렌더링 코드 수정 불필요**:

```jsx
// ❌ if-chain 금지 — 새 레이아웃 추가 시 3곳 수정 필요
{layout === 'compact' && <LayoutA {...props} />}
{layout === 'magazine' && <LayoutB {...props} accentColor={accentColor} />}

// ✅ LAYOUTS 맵 패턴
const LAYOUTS = {
  compact:  { component: LayoutA, extraProps: {} },
  magazine: { component: LayoutB, extraProps: { accentColor } },
  default:  { component: LayoutC, extraProps: { categories } },
};
const { component: Layout, extraProps } = LAYOUTS[layout] || LAYOUTS.default;
<Layout posts={posts} loading={loading} {...extraProps} />
```

### DRY — localStorage 직접 접근 금지

`localStorage.getItem('token')` / `JSON.parse(localStorage.getItem('user'))` 직접 접근 대신 **반드시 `useAuth()`** 사용:

```jsx
// ❌ 금지 — 15개 파일에 흩어지면 키 변경 시 전체 수정 필요
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

// ✅ useAuth 훅으로 통합
import { useAuth } from '../hooks/useAuth';
const { token, user, isLoggedIn } = useAuth();
```

`authHeader`도 마찬가지 — 각 api/*.js에서 로컬 선언 대신 `client.js`에서 import:

```js
// ❌ 금지 — 9개 api/*.js에서 동일 함수 선언 반복
const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

// ✅ api/client.js에서 import
import { authHeader } from './client';
```

### ISP — 컴포넌트는 필요한 props만 수신

레이아웃·카드 등 재사용 컴포넌트에 사용하지 않는 props를 전달하지 말 것. 레이아웃별 특수 props는 `extraProps`로 분리:

```jsx
// ❌ 모든 레이아웃에 accentColor + categories 전달 (일부는 사용 안 함)
<LayoutCompact posts={posts} accentColor={accentColor} categories={categories} />

// ✅ 공통 props는 spread, 특수 props는 extraProps로 분리
<Layout posts={posts} loading={loading} hasMore={hasMore} sentinelRef={sentinelRef} {...extraProps} />
```

---

## 8. 완료 체크리스트

- [ ] CSS Variables 사용, Tailwind 미사용
- [ ] axios 사용, fetch 미사용
- [ ] `useAuth()` 훅 사용 (`localStorage` 직접 접근 금지)
- [ ] `authHeader`는 `api/client.js`에서 import (로컬 선언 금지)
- [ ] 데이터 페칭 로직은 Custom Hook(`hooks/useXxx.js`)으로 분리
- [ ] 변형/레이아웃 분기는 LAYOUTS 맵 패턴 (if-chain 금지)
- [ ] 권한 확인 로직 포함 (필요 시)
- [ ] API 클라이언트는 `src/api/`에 분리
- [ ] App.jsx에 Route 등록
- [ ] 다크모드에서도 동작 확인 (CSS Variables 사용이면 자동)
