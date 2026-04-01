import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWizardStatus, submitWizardSetup } from '../api/wizard';

const TOTAL_STEPS = 4;

export default function SetupWizard({ dbConnected = true }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // wizard 완료 상태에서 직접 접근 시 대시보드로 리다이렉트
  useEffect(() => {
    let cancelled = false;
    getWizardStatus().then((res) => {
      if (cancelled) return;
      if (res.success && res.data && res.data.completed) {
        navigate('/', { replace: true });
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [admin, setAdmin] = useState({ username: '', email: '', password: '', confirm: '' });
  const [site, setSite] = useState({ site_title: '', site_url: '', tagline: '' });

  const goNext = () => setStep((s) => s + 1);

  const handleAdminNext = (e) => {
    e.preventDefault();
    setError('');
    if (!admin.username || !admin.email || !admin.password) {
      setError('모든 필드를 입력해주세요.');
      return;
    }
    if (admin.password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    if (admin.password !== admin.confirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    goNext();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await submitWizardSetup({ admin, site });
    setLoading(false);
    if (!res.success) {
      setError(res.error || '설정 중 오류가 발생했습니다.');
      return;
    }
    goNext();
  };

  return (
    <div className="wizard-container" style={styles.container}>
      <div className="wizard-card card" style={styles.card}>
        {/* 진행 표시 */}
        <div style={styles.progress}>
          <span style={styles.progressText}>{step} / {TOTAL_STEPS}</span>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${(step / TOTAL_STEPS) * 100}%` }} />
          </div>
        </div>

        {/* Step 1: 환영 */}
        {step === 1 && (
          <div>
            <h1 style={styles.title}>CMS 설치에 오신 것을 환영합니다</h1>
            <p style={styles.desc}>
              이 마법사는 관리자 계정 생성과 기본 사이트 설정을 안내합니다.
            </p>
            <div style={styles.statusBox}>
              <span>DB 연결 상태: </span>
              {dbConnected ? (
                <span className="badge" style={styles.badgeGreen}>연결됨</span>
              ) : (
                <span className="badge" style={styles.badgeRed}>연결 실패</span>
              )}
            </div>
            <button className="btn btn-primary" style={styles.btn} onClick={goNext}>
              시작하기
            </button>
          </div>
        )}

        {/* Step 2: 관리자 계정 */}
        {step === 2 && (
          <form onSubmit={handleAdminNext}>
            <h2 style={styles.title}>관리자 계정 설정</h2>
            <p style={styles.desc}>사이트를 관리할 관리자 계정을 생성합니다.</p>
            {error && <div className="alert alert-error">{error}</div>}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>아이디</label>
              <input
                className="form-input"
                type="text"
                value={admin.username}
                onChange={(e) => setAdmin({ ...admin, username: e.target.value })}
                placeholder="관리자 아이디"
                required
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>이메일</label>
              <input
                className="form-input"
                type="email"
                value={admin.email}
                onChange={(e) => setAdmin({ ...admin, email: e.target.value })}
                placeholder="admin@example.com"
                required
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>비밀번호 (8자 이상)</label>
              <input
                className="form-input"
                type="password"
                value={admin.password}
                onChange={(e) => setAdmin({ ...admin, password: e.target.value })}
                placeholder="비밀번호"
                required
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>비밀번호 확인</label>
              <input
                className="form-input"
                type="password"
                value={admin.confirm}
                onChange={(e) => setAdmin({ ...admin, confirm: e.target.value })}
                placeholder="비밀번호 재입력"
                required
              />
            </div>
            <button className="btn btn-primary" style={styles.btn} type="submit">
              다음
            </button>
          </form>
        )}

        {/* Step 3: 사이트 설정 */}
        {step === 3 && (
          <form onSubmit={handleSubmit}>
            <h2 style={styles.title}>사이트 기본 설정</h2>
            <p style={styles.desc}>사이트 기본 정보를 입력합니다. (선택 사항)</p>
            {error && <div className="alert alert-error">{error}</div>}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>사이트 이름</label>
              <input
                className="form-input"
                type="text"
                value={site.site_title}
                onChange={(e) => setSite({ ...site, site_title: e.target.value })}
                placeholder="내 블로그"
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>사이트 URL</label>
              <input
                className="form-input"
                type="url"
                value={site.site_url}
                onChange={(e) => setSite({ ...site, site_url: e.target.value })}
                placeholder="https://example.com"
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>태그라인</label>
              <input
                className="form-input"
                type="text"
                value={site.tagline}
                onChange={(e) => setSite({ ...site, tagline: e.target.value })}
                placeholder="짧은 소개글"
              />
            </div>
            <div style={styles.btnRow}>
              <button
                className="btn"
                type="button"
                onClick={() => setStep(2)}
                style={{ marginRight: 8 }}
              >
                이전
              </button>
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? '설정 중...' : '완료'}
              </button>
            </div>
          </form>
        )}

        {/* Step 4: 완료 */}
        {step === 4 && (
          <div style={{ textAlign: 'center' }}>
            <div style={styles.successIcon}>✓</div>
            <h2 style={styles.title}>설치 완료!</h2>
            <p style={styles.desc}>
              관리자 계정이 생성되었습니다. 로그인 후 사이트를 관리할 수 있습니다.
            </p>
            <button
              className="btn btn-primary"
              style={styles.btn}
              onClick={() => navigate('/login')}
            >
              로그인 페이지로 이동
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    background: 'var(--bg)',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    padding: '2rem',
  },
  progress: {
    marginBottom: '1.5rem',
  },
  progressText: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    display: 'block',
    marginBottom: '0.4rem',
  },
  progressBar: {
    height: 4,
    background: 'var(--border)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'var(--accent)',
    borderRadius: 2,
    transition: 'width 0.3s ease',
  },
  title: {
    marginTop: 0,
    marginBottom: '0.5rem',
    fontSize: '1.4rem',
    color: 'var(--text)',
  },
  desc: {
    marginTop: 0,
    marginBottom: '1.5rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
  },
  statusBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: '1.5rem',
    color: 'var(--text-secondary)',
  },
  badgeGreen: {
    background: '#22c55e',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: 4,
  },
  badgeRed: {
    background: '#ef4444',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: 4,
  },
  btn: {
    width: '100%',
    marginTop: 4,
  },
  btnRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  fieldGroup: {
    marginBottom: '1rem',
  },
  label: {
    display: 'block',
    marginBottom: 4,
    fontSize: '0.9rem',
    color: 'var(--text)',
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: '2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1.5rem',
  },
};
