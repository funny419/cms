import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { usePostEditor } from '../hooks/usePostEditor';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useParams: () => ({ id: undefined }),
  };
});

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ token: 'test-token', user: { role: 'editor', username: 'testuser' } }),
}));

vi.mock('../api/posts', () => ({
  getPost: vi.fn(),
  createPost: vi.fn(),
  updatePost: vi.fn(),
}));

vi.mock('../api/tags', () => ({
  getTags: vi.fn(() => Promise.resolve({ success: true, data: { items: [] } })),
}));

function wrapper({ children }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('usePostEditor', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('title이 비어있을 때 handleSave는 error를 설정하고 API를 호출하지 않는다', async () => {
    const { createPost } = await import('../api/posts');
    const { result } = renderHook(() => usePostEditor(), { wrapper });
    await act(async () => {});

    expect(result.current.form.title).toBe('');

    await act(async () => {
      await result.current.handleSave('published');
    });

    expect(result.current.error).toBe('제목을 입력해주세요.');
    expect(createPost).not.toHaveBeenCalled();
  });

  it('title과 content가 있을 때 10초 후 localStorage에 draft가 자동저장된다', async () => {
    const { result } = renderHook(() => usePostEditor(), { wrapper });
    await act(async () => {});

    act(() => {
      result.current.setForm((prev) => ({ ...prev, title: '테스트 제목', content: '본문 내용' }));
    });

    expect(localStorage.getItem('cms_post_draft')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    const saved = JSON.parse(localStorage.getItem('cms_post_draft'));
    expect(saved.title).toBe('테스트 제목');
    expect(saved.content).toBe('본문 내용');
  });

  it('title과 content가 모두 비어있으면 자동저장하지 않는다', async () => {
    renderHook(() => usePostEditor(), { wrapper });
    await act(async () => {});

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(localStorage.getItem('cms_post_draft')).toBeNull();
  });
});
