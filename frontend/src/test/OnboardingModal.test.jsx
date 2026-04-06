import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OnboardingModal from '../components/OnboardingModal';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderModal() {
  return render(
    <MemoryRouter>
      <OnboardingModal />
    </MemoryRouter>
  );
}

function setUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

describe('OnboardingModal', () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockClear();
  });

  it('localStorage에 user가 없으면 모달이 렌더링되지 않는다', () => {
    const { container } = renderModal();
    expect(container).toBeEmptyDOMElement();
  });

  it('role이 admin이면 모달이 렌더링되지 않는다', () => {
    setUser({ role: 'admin', bio: null, avatar_url: null });
    const { container } = renderModal();
    expect(container).toBeEmptyDOMElement();
  });

  it('onboarding_done이 설정되어 있으면 모달이 렌더링되지 않는다', () => {
    setUser({ role: 'editor', bio: null, avatar_url: null });
    localStorage.setItem('onboarding_done', 'true');
    const { container } = renderModal();
    expect(container).toBeEmptyDOMElement();
  });

  it('이미 bio가 있으면 모달이 렌더링되지 않는다', () => {
    setUser({ role: 'editor', bio: '안녕하세요', avatar_url: null });
    const { container } = renderModal();
    expect(container).toBeEmptyDOMElement();
  });

  it('이미 avatar_url이 있으면 모달이 렌더링되지 않는다', () => {
    setUser({ role: 'editor', bio: null, avatar_url: 'http://example.com/avatar.jpg' });
    const { container } = renderModal();
    expect(container).toBeEmptyDOMElement();
  });

  it('editor이고 bio/avatar_url이 없고 onboarding_done이 없으면 모달이 표시된다', () => {
    setUser({ role: 'editor', bio: null, avatar_url: null });
    renderModal();
    expect(screen.getByText('블로그를 꾸며보세요!')).toBeInTheDocument();
  });

  it('모달에 지금 설정하기와 나중에 버튼이 있다', () => {
    setUser({ role: 'editor', bio: null, avatar_url: null });
    renderModal();
    expect(screen.getByRole('button', { name: '지금 설정하기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '나중에' })).toBeInTheDocument();
  });

  it('나중에 클릭 시 모달이 닫히고 onboarding_done이 설정된다', async () => {
    setUser({ role: 'editor', bio: null, avatar_url: null });
    renderModal();
    const laterBtn = screen.getByRole('button', { name: '나중에' });
    await userEvent.click(laterBtn);
    expect(screen.queryByText('블로그를 꾸며보세요!')).not.toBeInTheDocument();
    expect(localStorage.getItem('onboarding_done')).toBe('true');
  });

  it('지금 설정하기 클릭 시 /my-blog/settings로 이동하고 onboarding_done이 설정된다', async () => {
    setUser({ role: 'editor', bio: null, avatar_url: null });
    renderModal();
    const setupBtn = screen.getByRole('button', { name: '지금 설정하기' });
    await userEvent.click(setupBtn);
    expect(localStorage.getItem('onboarding_done')).toBe('true');
    expect(mockNavigate).toHaveBeenCalledWith('/my-blog/settings');
  });

  it('localStorage JSON 파싱 오류 시 모달이 렌더링되지 않는다', () => {
    localStorage.setItem('user', 'invalid-json');
    const { container } = renderModal();
    expect(container).toBeEmptyDOMElement();
  });
});
