import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SKINS, useSkin } from '../../context/SkinContext';
import { updateSettings } from '../../api/settings';

export default function AdminSettings() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const { skin: currentSkin, setSkin } = useSkin();

  const [selected, setSelected] = useState(currentSkin);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // 권한 확인
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!token || user?.role !== 'admin') {
      navigate('/login');
      return null;
    }
  } catch {
    navigate('/login');
    return null;
  }

  const handlePreview = (skinId) => {
    setSelected(skinId);
    setSkin(skinId); // 즉시 미리보기 (저장 없음)
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const res = await updateSettings(token, { site_skin: selected });
    setSaving(false);
    if (res.success) {
      setSaved(true);
    } else {
      setError(res.error);
      setSkin(currentSkin); // 실패 시 원래 스킨으로 복구
    }
  };

  return (
    <div className="page-content" style={{ maxWidth: 640 }}>
      <h1 className="page-heading" style={{ marginBottom: 8 }}>사이트 설정</h1>
      <p style={{ color: 'var(--text-light)', fontSize: 14, marginBottom: 32 }}>
        스킨을 선택하면 즉시 미리보기가 적용됩니다. 저장 버튼을 눌러야 반영됩니다.
      </p>

      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--text-h)' }}>스킨 선택</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
        {SKINS.map((s) => {
          const isActive = selected === s.id;
          return (
            <button
              key={s.id}
              onClick={() => handlePreview(s.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                border: `2px solid ${isActive ? s.color : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
                background: isActive ? `${s.color}0d` : 'var(--bg)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              {/* 컬러 칩 */}
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: s.color,
                flexShrink: 0,
                boxShadow: isActive ? `0 0 0 3px ${s.color}40` : 'none',
              }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-h)' }}>{s.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>{s.description}</div>
              </div>
              {isActive && (
                <div style={{ marginLeft: 'auto', color: s.color, fontSize: 16 }}>✓</div>
              )}
            </button>
          );
        })}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      {saved && (
        <div className="alert" style={{ marginBottom: 16, background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }}>
          스킨이 저장됐습니다.
        </div>
      )}

      <button
        className="btn btn-primary"
        onClick={handleSave}
        disabled={saving}
        style={{ minWidth: 100 }}
      >
        {saving ? '저장 중...' : '저장'}
      </button>
    </div>
  );
}
