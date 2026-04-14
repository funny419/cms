import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ProfileCard from '../components/ProfileCard';

const baseUser = {
  username: 'alice',
  blog_title: null,
  bio: null,
  avatar_url: null,
  blog_color: null,
  website_url: null,
  social_links: {},
  post_count: 5,
  follower_count: 10,
  following_count: 3,
  created_at: '2024-01-01T00:00:00Z',
};

describe('ProfileCard', () => {
  it('user가 null이면 아무것도 렌더링되지 않는다', () => {
    const { container } = render(<ProfileCard user={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('blog_title이 없으면 username+의 블로그가 표시된다', () => {
    render(<ProfileCard user={baseUser} />);
    expect(screen.getByText("alice의 블로그")).toBeInTheDocument();
  });

  it('blog_title이 있으면 해당 제목이 표시된다', () => {
    render(<ProfileCard user={{ ...baseUser, blog_title: '앨리스의 개발 노트' }} />);
    expect(screen.getByText('앨리스의 개발 노트')).toBeInTheDocument();
  });

  it('isOwnBlog=true이면 팔로우 버튼이 렌더링되지 않는다', () => {
    render(<ProfileCard user={baseUser} isOwnBlog={true} onFollow={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /팔로/ })).not.toBeInTheDocument();
  });

  it('isOwnBlog=false이고 onFollow가 있으면 팔로우 버튼이 렌더링된다', () => {
    render(<ProfileCard user={baseUser} isOwnBlog={false} onFollow={vi.fn()} isFollowing={false} />);
    expect(screen.getByRole('button', { name: '팔로우' })).toBeInTheDocument();
  });

  it('isFollowing=false이면 팔로우 텍스트가 표시된다', () => {
    render(<ProfileCard user={baseUser} isOwnBlog={false} onFollow={vi.fn()} isFollowing={false} />);
    expect(screen.getByText('팔로우')).toBeInTheDocument();
  });

  it('isFollowing=true이면 팔로잉 ✓ 텍스트와 aria-label 팔로잉 취소가 표시된다', () => {
    render(<ProfileCard user={baseUser} isOwnBlog={false} onFollow={vi.fn()} isFollowing={true} />);
    expect(screen.getByText('팔로잉 ✓')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '팔로잉 취소' })).toBeInTheDocument();
  });

  it('onFollow가 없으면 팔로우 버튼이 렌더링되지 않는다', () => {
    render(<ProfileCard user={baseUser} isOwnBlog={false} />);
    expect(screen.queryByRole('button', { name: /팔로/ })).not.toBeInTheDocument();
  });
});
