import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getWizardStatus,
  testDbConnection,
  saveEnvFile,
  runMigration,
  submitWizardSetup,
} from '../api/wizard';
import { useFetch } from '../hooks/useFetch';

const TOTAL_STEPS = 5;

const DB_ERROR_LABELS = {
  auth_failed: '인증 실패: 사용자명 또는 비밀번호가 올바르지 않습니다.',
  host_unreachable: '호스트 접근 불가: DB 서버 주소 또는 포트를 확인하세요.',
  db_not_found: 'DB 없음: 해당 데이터베이스가 없거나 접근 권한이 없습니다.',
  invalid_url: 'URL 오류: 연결 정보가 올바르지 않습니다.',
  unknown: '알 수 없는 오류: DB 서버 로그를 확인하세요.',
};

export default function SetupWizard() {
  const navigate = useNavigate();
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [step, setStep] = useState(1);
  const [adminSubStep, setAdminSubStep] = useState(1); // Step 4: 1=계정, 2=사이트
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [migStatus, setMigStatus] = useState('idle'); // idle | running | success | failed
  const [migError, setMigError] = useState('');

  const [dbForm, setDbForm] = useState({ host: '', port: '3306', user: '', password: '', dbname: '' });
  const [admin, setAdmin] = useState({ username: '', email: '', password: '', confirm: '' });
  const [site, setSite] = useState({ site_title: '', site_url: '', tagline: '' });

  const goToStep = (n) => {
    localStorage.setItem('wizard_step', String(n));
    setStep(n);
    setError('');
  };

  // 마운트 시 wizard 상태 확인 — 서버 step과 localStorage step 중 큰 값 사용
  useFetch(
    getWizardStatus,
    (res) => {
      if (res.success && res.data?.completed) { navigate('/', { replace: true }); return; }
      const serverStep = res.success ? (res.data?.step ?? 1) : 1;
      const localStep = parseInt(localStorage.getItem('wizard_step') || '0', 10);
      setStep(Math.max(serverStep, localStep));
      setStatusLoaded(true);
    },
    []
  );

  // Step 3: 마이그레이션 자동 실행
  useFetch(
    () => {
      if (step !== 3 || !statusLoaded || migStatus !== 'idle') return null;
      setMigStatus('running');
      return runMigration();
    },
    (res) => {
      if (res.success) {
        setMigStatus('success');
        setTimeout(() => { goToStep(4); }, 1200);
      } else {
        setMigStatus('failed');
        setMigError(res.error || '마이그레이션 실패');
      }
    },
    [step, statusLoaded, migStatus]
  );

  // Step 1: DB 연결 테스트 + .env 저장
  const handleDbConnect = async (e) => {
    e.preventDefault();
    setError('');
    if (!dbForm.host || !dbForm.user || !dbForm.password || !dbForm.dbname) {
      setError('모든 필드를 입력해주세요.');
      return;
    }
    setLoading(true);
    const testRes = await testDbConnection(dbForm);
    if (!testRes.success) {
      const code = testRes.data?.error_code;
      setError(DB_ERROR_LABELS[code] || testRes.error || 'DB 연결 실패.');
      setLoading(false);
      return;
    }
    const envRes = await saveEnvFile(dbForm);
    setLoading(false);
    if (!envRes.success) {
      setError(envRes.error || '.env 파일 생성 실패.');
      return;
    }
    goToStep(2);
  };

  // Step 4 sub-step 1: 관리자 계정 유효성 검사
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
    setAdminSubStep(2);
  };

  // Step 4 sub-step 2: 최종 제출
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
    localStorage.removeItem('wizard_step');
    goToStep(5);
  };

  if (!statusLoaded) {
    return (
      <div style={styles.container}>
        <div className="card" style={styles.card}>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>로딩 중...</p>
        </div>
      </div>
    );
  }

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

        {/* Step 1: DB 연결 정보 */}
        {step === 1 && (
          <form onSubmit={handleDbConnect}>
            <h2 style={styles.title}>데이터베이스 연결 설정</h2>
            <p style={styles.desc}>MariaDB 연결 정보를 입력하세요. CMS가 사용할 데이터베이스입니다.</p>
            {error && <div className="alert alert-error">{error}</div>}
            <div style={styles.row2}>
              <div style={{ ...styles.fieldGroup, flex: 2 }}>
                <label style={styles.label}>호스트</label>
                <input
                  className="form-input"
                  type="text"
                  value={dbForm.host}
                  onChange={(e) => setDbForm({ ...dbForm, host: e.target.value })}
                  placeholder="db 또는 localhost"
                  required
                />
              </div>
              <div style={{ ...styles.fieldGroup, flex: 1 }}>
                <label style={styles.label}>포트</label>
                <input
                  className="form-input"
                  type="number"
                  value={dbForm.port}
                  onChange={(e) => setDbForm({ ...dbForm, port: e.target.value })}
                  placeholder="3306"
                  required
                />
              </div>
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>DB 사용자명</label>
              <input
                className="form-input"
                type="text"
                value={dbForm.user}
                onChange={(e) => setDbForm({ ...dbForm, user: e.target.value })}
                placeholder="funnycms"
                required
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>DB 비밀번호</label>
              <input
                className="form-input"
                type="password"
                value={dbForm.password}
                onChange={(e) => setDbForm({ ...dbForm, password: e.target.value })}
                placeholder="비밀번호"
                required
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>데이터베이스 이름</label>
              <input
                className="form-input"
                type="text"
                value={dbForm.dbname}
                onChange={(e) => setDbForm({ ...dbForm, dbname: e.target.value })}
                placeholder="cmsdb"
                required
              />
            </div>
            <button className="btn btn-primary" style={styles.btn} type="submit" disabled={loading}>
              {loading ? '연결 확인 중...' : '연결 테스트 및 저장'}
            </button>
          </form>
        )}

        {/* Step 2: 재시작 안내 */}
        {step === 2 && (
          <div>
            <h2 style={styles.title}>설정 파일 저장 완료</h2>
            <p style={styles.desc}>
              DB 연결 정보가 <code style={styles.code}>.env</code> 파일에 저장되었습니다.
              변경 사항을 적용하려면 백엔드를 재시작해야 합니다.
            </p>
            <div style={styles.cmdBox}>
              <p style={styles.cmdLabel}>터미널에서 아래 명령을 실행하세요:</p>
              <code style={styles.cmdCode}>docker compose restart backend</code>
            </div>
            <p style={styles.desc}>재시작이 완료되면 아래 버튼을 클릭하세요.</p>
            <button
              className="btn btn-primary"
              style={styles.btn}
              onClick={() => {
                localStorage.setItem('wizard_step', '3');
                window.location.reload();
              }}
            >
              재시작 완료 — 새로고침
            </button>
          </div>
        )}

        {/* Step 3: 마이그레이션 */}
        {step === 3 && (
          <div>
            <h2 style={styles.title}>데이터베이스 초기화</h2>
            <p style={styles.desc}>테이블 스키마를 생성합니다. 잠시 기다려주세요.</p>
            {migStatus === 'running' && (
              <div style={styles.statusBox}>
                <div style={styles.spinner} />
                <span>마이그레이션 실행 중...</span>
              </div>
            )}
            {migStatus === 'success' && (
              <div style={{ ...styles.statusBox, color: '#22c55e' }}>
                <span>✓ 마이그레이션 완료 — 다음 단계로 이동합니다.</span>
              </div>
            )}
            {migStatus === 'failed' && (
              <div>
                <div className="alert alert-error">{migError}</div>
                <button
                  className="btn btn-primary"
                  style={styles.btn}
                  onClick={() => { setMigStatus('idle'); setMigError(''); }}
                >
                  다시 시도
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 4 — sub-step 1: 관리자 계정 */}
        {step === 4 && adminSubStep === 1 && (
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

        {/* Step 4 — sub-step 2: 사이트 설정 */}
        {step === 4 && adminSubStep === 2 && (
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
                onClick={() => { setAdminSubStep(1); setError(''); }}
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

        {/* Step 5: 완료 */}
        {step === 5 && (
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
  row2: {
    display: 'flex',
    gap: 12,
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
  btn: {
    width: '100%',
    marginTop: 4,
  },
  btnRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  statusBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: '1.5rem',
    color: 'var(--text-secondary)',
  },
  spinner: {
    display: 'inline-block',
    width: 18,
    height: 18,
    border: '2px solid var(--border)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    flexShrink: 0,
  },
  cmdBox: {
    background: 'var(--surface, #f4f4f4)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '1rem',
    marginBottom: '1.5rem',
  },
  cmdLabel: {
    margin: '0 0 0.5rem',
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
  },
  cmdCode: {
    display: 'block',
    fontFamily: 'monospace',
    color: 'var(--text)',
    fontSize: '0.95rem',
  },
  code: {
    fontFamily: 'monospace',
    background: 'var(--surface, #f4f4f4)',
    padding: '1px 4px',
    borderRadius: 3,
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
