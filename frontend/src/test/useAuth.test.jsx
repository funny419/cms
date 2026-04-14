import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuth } from '../hooks/useAuth';

describe('useAuth', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('localStorage가 비어 있으면 token=null, user=null, isLoggedIn=false를 반환한다', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.isLoggedIn).toBe(false);
  });

  it('localStorage에 token이 있으면 해당 값을 반환하고 isLoggedIn=true이다', () => {
    localStorage.setItem('token', 'my-jwt-token');
    const { result } = renderHook(() => useAuth());
    expect(result.current.token).toBe('my-jwt-token');
    expect(result.current.isLoggedIn).toBe(true);
  });

  it('localStorage에 user JSON이 있으면 파싱된 객체를 반환한다', () => {
    const user = { id: 1, username: 'testuser', role: 'editor' };
    localStorage.setItem('user', JSON.stringify(user));
    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toEqual(user);
  });

  it('logout()을 호출하면 localStorage에서 token과 user가 제거된다', () => {
    localStorage.setItem('token', 'my-jwt-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, username: 'testuser' }));
    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.logout();
    });

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('user JSON이 잘못된 형식이면 user=null을 반환한다', () => {
    localStorage.setItem('token', 'my-jwt-token');
    localStorage.setItem('user', 'not-valid-json');
    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toBeNull();
  });
});
