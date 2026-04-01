import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import SeriesNav from '../components/SeriesNav';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const series = {
  id: 1,
  title: 'React 입문 시리즈',
  slug: 'react-intro',
  posts: [
    { id: 10, title: '첫 번째 글', order: 0 },
    { id: 11, title: '두 번째 글', order: 1 },
    { id: 12, title: '세 번째 글', order: 2 },
  ],
};

function renderSeriesNav(props) {
  return render(
    <MemoryRouter>
      <SeriesNav {...props} />
    </MemoryRouter>
  );
}

describe('SeriesNav', () => {
  it('series가 null이면 아무것도 렌더링하지 않는다', () => {
    const { container } = renderSeriesNav({ series: null, currentPostId: 10 });
    expect(container).toBeEmptyDOMElement();
  });

  it('posts 배열이 비어있으면 아무것도 렌더링하지 않는다', () => {
    const emptySeries = { ...series, posts: [] };
    const { container } = renderSeriesNav({ series: emptySeries, currentPostId: 10 });
    expect(container).toBeEmptyDOMElement();
  });

  it('시리즈 제목을 렌더링한다', () => {
    renderSeriesNav({ series, currentPostId: 11 });
    expect(screen.getByText('React 입문 시리즈')).toBeInTheDocument();
  });

  it('현재 포스트 순서(n / 전체)를 표시한다', () => {
    // currentPostId=11 → 2번째 (index 1)
    renderSeriesNav({ series, currentPostId: 11 });
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('목차 보기 버튼 클릭 시 포스트 목록이 펼쳐진다', async () => {
    renderSeriesNav({ series, currentPostId: 11 });
    const toggleBtn = screen.getByRole('button', { name: /목차 보기/ });
    await userEvent.click(toggleBtn);
    expect(screen.getByText('1. 첫 번째 글')).toBeInTheDocument();
    expect(screen.getByText('2. 두 번째 글')).toBeInTheDocument();
    expect(screen.getByText('3. 세 번째 글')).toBeInTheDocument();
  });

  it('목차 펼친 후 닫기 버튼이 나타난다', async () => {
    renderSeriesNav({ series, currentPostId: 11 });
    const toggleBtn = screen.getByRole('button', { name: /목차 보기/ });
    await userEvent.click(toggleBtn);
    expect(screen.getByRole('button', { name: /목차 닫기/ })).toBeInTheDocument();
  });

  it('첫 번째 포스트에서는 이전 버튼이 없다', () => {
    renderSeriesNav({ series, currentPostId: 10 });
    // 이전 포스트 버튼이 없어야 함 (prev === null)
    expect(screen.queryByText(/← 첫 번째 글/)).not.toBeInTheDocument();
  });

  it('마지막 포스트에서는 다음 버튼이 없다', () => {
    renderSeriesNav({ series, currentPostId: 12 });
    expect(screen.queryByText(/세 번째 글 →/)).not.toBeInTheDocument();
  });

  it('중간 포스트에서 이전/다음 버튼이 모두 렌더링된다', () => {
    renderSeriesNav({ series, currentPostId: 11 });
    expect(screen.getByRole('button', { name: /← 첫 번째 글/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /세 번째 글 →/ })).toBeInTheDocument();
  });

  it('이전 버튼 클릭 시 이전 포스트로 navigate한다', async () => {
    mockNavigate.mockClear();
    renderSeriesNav({ series, currentPostId: 11 });
    const prevBtn = screen.getByRole('button', { name: /← 첫 번째 글/ });
    await userEvent.click(prevBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/posts/10');
  });

  it('다음 버튼 클릭 시 다음 포스트로 navigate한다', async () => {
    mockNavigate.mockClear();
    renderSeriesNav({ series, currentPostId: 11 });
    const nextBtn = screen.getByRole('button', { name: /세 번째 글 →/ });
    await userEvent.click(nextBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/posts/12');
  });
});
