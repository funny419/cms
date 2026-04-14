import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Nav from '../components/Nav';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}));

function renderNav() {
  return render(<MemoryRouter><Nav /></MemoryRouter>);
}

describe('Nav', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('비로그인 시 로그인/회원가입 링크가 렌더링된다', () => {
    renderNav();
    expect(screen.getByRole('link', { name: '로그인' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '회원가입' })).toBeInTheDocument();
  });

  it('비로그인 시 관리자/에디터 전용 메뉴가 없다', () => {
    renderNav();
    expect(screen.queryByText('포스트 관리')).not.toBeInTheDocument();
    expect(screen.queryByText('내 글')).not.toBeInTheDocument();
  });

  it('admin 로그인 시 관리자 메뉴(포스트/회원/댓글/사이트 설정)가 렌더링된다', () => {
    localStorage.setItem('token', 'tok');
    localStorage.setItem('user', JSON.stringify({ role: 'admin', username: 'admin' }));
    renderNav();
    expect(screen.getByRole('link', { name: '포스트 관리' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '회원 관리' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '댓글 관리' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '사이트 설정' })).toBeInTheDocument();
  });

  it('admin 로그인 시 에디터 전용 메뉴(피드/내 글)가 없다', () => {
    localStorage.setItem('token', 'tok');
    localStorage.setItem('user', JSON.stringify({ role: 'admin', username: 'admin' }));
    renderNav();
    expect(screen.queryByText('피드')).not.toBeInTheDocument();
    expect(screen.queryByText('내 글')).not.toBeInTheDocument();
  });

  it('editor 로그인 시 에디터 메뉴(피드/내 글/전체 글/프로필)가 렌더링된다', () => {
    localStorage.setItem('token', 'tok');
    localStorage.setItem('user', JSON.stringify({ role: 'editor', username: 'alice' }));
    renderNav();
    expect(screen.getByRole('link', { name: '피드' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '내 글' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '전체 글' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '프로필' })).toBeInTheDocument();
  });

  it('editor 로그인 시 관리자 전용 메뉴(포스트 관리/회원 관리)가 없다', () => {
    localStorage.setItem('token', 'tok');
    localStorage.setItem('user', JSON.stringify({ role: 'editor', username: 'alice' }));
    renderNav();
    expect(screen.queryByText('포스트 관리')).not.toBeInTheDocument();
    expect(screen.queryByText('회원 관리')).not.toBeInTheDocument();
  });
});
