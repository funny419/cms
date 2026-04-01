import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ShareButtons from '../components/ShareButtons';

const TEST_URL = 'http://localhost:3000/posts/1';
Object.defineProperty(window, 'location', {
  value: { href: TEST_URL },
  writable: true,
  configurable: true,
});

describe('ShareButtons', () => {
  let writeTextSpy;

  beforeEach(() => {
    // setup.js에서 navigator.clipboard가 초기화되어 있으므로 spyOn 가능
    writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Twitter, Facebook, LinkedIn 링크를 렌더링한다', () => {
    render(<ShareButtons title="테스트 글 제목" />);
    expect(screen.getByRole('link', { name: 'Twitter' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Facebook' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'LinkedIn' })).toBeInTheDocument();
  });

  it('링크 복사 버튼을 렌더링한다', () => {
    render(<ShareButtons title="테스트" />);
    expect(screen.getByRole('button', { name: /링크 복사/ })).toBeInTheDocument();
  });

  it('Twitter 링크에 URL이 인코딩되어 포함된다', () => {
    render(<ShareButtons title="테스트 글" />);
    const twitterLink = screen.getByRole('link', { name: 'Twitter' });
    const href = twitterLink.getAttribute('href');
    expect(href).toContain('twitter.com/intent/tweet');
    expect(href).toContain(encodeURIComponent(TEST_URL));
  });

  it('한글 제목이 URL 인코딩되어 Twitter 링크에 포함된다', () => {
    render(<ShareButtons title="한글 제목 테스트" />);
    const twitterLink = screen.getByRole('link', { name: 'Twitter' });
    const href = twitterLink.getAttribute('href');
    expect(href).toContain(encodeURIComponent('한글 제목 테스트'));
  });

  it('Facebook 링크에 URL이 인코딩되어 포함된다', () => {
    render(<ShareButtons title="테스트" />);
    const facebookLink = screen.getByRole('link', { name: 'Facebook' });
    const href = facebookLink.getAttribute('href');
    expect(href).toContain('facebook.com/sharer');
    expect(href).toContain(encodeURIComponent(TEST_URL));
  });

  it('LinkedIn 링크에 URL과 제목이 인코딩되어 포함된다', () => {
    render(<ShareButtons title="LinkedIn 공유 테스트" />);
    const linkedinLink = screen.getByRole('link', { name: 'LinkedIn' });
    const href = linkedinLink.getAttribute('href');
    expect(href).toContain('linkedin.com/shareArticle');
    expect(href).toContain(encodeURIComponent(TEST_URL));
    expect(href).toContain(encodeURIComponent('LinkedIn 공유 테스트'));
  });

  it('모든 소셜 링크는 새 탭으로 열린다', () => {
    render(<ShareButtons title="테스트" />);
    ['Twitter', 'Facebook', 'LinkedIn'].forEach((label) => {
      const link = screen.getByRole('link', { name: label });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  it('링크 복사 클릭 시 clipboard.writeText가 호출된다', async () => {
    render(<ShareButtons title="테스트" />);
    const copyBtn = screen.getByRole('button', { name: /링크 복사/ });
    await act(async () => {
      copyBtn.click();
    });
    expect(writeTextSpy).toHaveBeenCalledWith(TEST_URL);
  });

  it('링크 복사 후 버튼 텍스트가 복사됨으로 변경된다', async () => {
    render(<ShareButtons title="테스트" />);
    const copyBtn = screen.getByRole('button', { name: /링크 복사/ });
    await act(async () => {
      copyBtn.click();
    });
    expect(screen.getByRole('button', { name: /복사됨/ })).toBeInTheDocument();
  });

  it('2초 후 복사됨 메시지가 사라진다', async () => {
    vi.useFakeTimers();
    render(<ShareButtons title="테스트" />);
    const copyBtn = screen.getByRole('button', { name: /링크 복사/ });
    await act(async () => {
      copyBtn.click();
      await Promise.resolve(); // flush microtasks (clipboard.writeText promise)
    });
    expect(screen.getByRole('button', { name: /복사됨/ })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByRole('button', { name: /링크 복사/ })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('title이 없어도 오류 없이 렌더링된다', () => {
    render(<ShareButtons />);
    expect(screen.getByRole('link', { name: 'Twitter' })).toBeInTheDocument();
  });
});
