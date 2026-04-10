import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function OnboardingModal() {
  const { user } = useAuth();
  const done = localStorage.getItem('onboarding_done');
  const [show, setShow] = useState(
    !!(user && user.role === 'editor' && !done && !user.bio && !user.avatar_url)
  );
  const navigate = useNavigate();

  if (!show) return null;

  const handleLater = () => {
    localStorage.setItem('onboarding_done', 'true');
    setShow(false);
  };

  const handleSetup = () => {
    localStorage.setItem('onboarding_done', 'true');
    setShow(false);
    navigate('/my-blog/settings');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div className="card" style={{ maxWidth: 400, width: '90%', padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎨</div>
        <h2 style={{ marginBottom: 8 }}>블로그를 꾸며보세요!</h2>
        <p style={{ color: 'var(--text-light)', fontSize: 14, marginBottom: 24 }}>
          지금 바로 설정하면 멋진 블로그를 만들 수 있어요.
        </p>
        <div style={{ textAlign: 'left', marginBottom: 24 }}>
          {['프로필 사진 추가 (30초)', '블로그 소개글 작성 (1분)', '디자인 테마 선택 (30초)'].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 14 }}>
              <span>☐</span><span>{item}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSetup}>지금 설정하기</button>
          <button className="btn btn-ghost" onClick={handleLater}>나중에</button>
        </div>
      </div>
    </div>
  );
}
