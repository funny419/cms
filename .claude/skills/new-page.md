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
import axios from 'axios';

// 권한 확인 패턴 (로그인 필요 페이지)
const getUser = () => {
  try { return JSON.parse(localStorage.getItem('user')); }
  catch { return null; }
};

export default function PageName() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const user = getUser();
    if (!user) { window.location.href = '/login'; return; }
    // admin 전용이면: if (user.role !== 'admin') { window.location.href = '/'; return; }

    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get('/api/...', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.error || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">로딩 중...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div className="container">
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
// ✅ axios 사용
import axios from 'axios';
const res = await axios.get('/api/...');

// ❌ fetch 금지
const res = await fetch('/api/...');
```

API 클라이언트는 `frontend/src/api/` 에 분리 권장:
```js
// frontend/src/api/domain.js
import axios from 'axios';
const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
export const getDomainData = () => axios.get('/api/domain', { headers: getHeaders() });
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

## 7. 완료 체크리스트

- [ ] CSS Variables 사용, Tailwind 미사용
- [ ] axios 사용, fetch 미사용
- [ ] 권한 확인 로직 포함 (필요 시)
- [ ] `getUser()` 패턴으로 localStorage 파싱
- [ ] API 클라이언트는 `src/api/`에 분리
- [ ] App.jsx에 Route 등록
- [ ] 다크모드에서도 동작 확인 (CSS Variables 사용이면 자동)
