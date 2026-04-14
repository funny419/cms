import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CommentSection from '../components/CommentSection';

vi.mock('../api/comments', () => ({
  listComments: vi.fn(),
  createComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
}));

import { listComments } from '../api/comments';

const emptyResponse = { success: true, data: [] };

function renderSection(user = null) {
  return render(
    <MemoryRouter>
      <CommentSection postId={1} user={user} />
    </MemoryRouter>
  );
}

describe('CommentSection', () => {
  beforeEach(() => {
    localStorage.clear();
    listComments.mockResolvedValue(emptyResponse);
  });

  it('비로그인 시 게스트 폼 필드(이름/이메일/패스워드)가 표시된다', async () => {
    // localStorage에 token 없음 → useAuth().token = null
    renderSection();
    await waitFor(() => {
      expect(screen.getByPlaceholderText('이름 *')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('이메일 *')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('패스워드 * (수정/삭제에 사용)')).toBeInTheDocument();
    });
  });

  it('로그인 시 게스트 폼 필드가 표시되지 않는다', async () => {
    localStorage.setItem('token', 'my-token');
    renderSection({ id: 1, role: 'editor' });
    await waitFor(() => {
      expect(listComments).toHaveBeenCalled();
    });
    expect(screen.queryByPlaceholderText('이름 *')).not.toBeInTheDocument();
  });

  it('본인 댓글(author_id 일치)에는 수정/삭제 버튼이 표시된다', async () => {
    localStorage.setItem('token', 'my-token');
    const comment = {
      id: 10, content: '내 댓글입니다', author_id: 5,
      author_name: 'alice', parent_id: null, created_at: null,
    };
    listComments.mockResolvedValue({ success: true, data: [comment] });
    renderSection({ id: 5, role: 'editor' });

    await waitFor(() => {
      expect(screen.getByText('내 댓글입니다')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
  });

  it('타인 댓글(author_id 불일치)에는 수정/삭제 버튼이 표시되지 않는다', async () => {
    localStorage.setItem('token', 'my-token');
    const comment = {
      id: 11, content: '타인 댓글입니다', author_id: 99,
      author_name: 'other', parent_id: null, created_at: null,
    };
    listComments.mockResolvedValue({ success: true, data: [comment] });
    renderSection({ id: 5, role: 'editor' });

    await waitFor(() => {
      expect(screen.getByText('타인 댓글입니다')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: '수정' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
  });
});
