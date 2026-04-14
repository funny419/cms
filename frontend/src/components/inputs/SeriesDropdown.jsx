import { useState } from 'react';
import { getUserSeries, createSeries } from '../../api/series';
import { useFetch } from '../../hooks/useFetch';
import { useAuth } from '../../hooks/useAuth';

/**
 * SeriesDropdown — 시리즈 단일 선택 셀렉트 + 인라인 생성
 * Props:
 *   value: number | null
 *   onChange: (seriesId: number | null) => void
 *   username: string (현재 로그인 유저의 username)
 */
export default function SeriesDropdown({ value = null, onChange, username }) {
  const { token } = useAuth();
  const [series, setSeries] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  useFetch(
    () => username ? getUserSeries(username) : null,
    (res) => { if (res.success) setSeries(res.data.items || []); },
    [username]
  );

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    const res = await createSeries(token, { title: newTitle.trim() });
    setCreating(false);
    if (res.success) {
      setSeries((prev) => [...prev, res.data]);
      onChange(res.data.id);
      setNewTitle('');
    }
  };

  return (
    <div>
      <select
        className="form-input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? parseInt(e.target.value, 10) : null)}
      >
        <option value="">시리즈 없음</option>
        {series.map((s) => (
          <option key={s.id} value={s.id}>{s.title}</option>
        ))}
      </select>
      <div style={{ marginTop: 8 }}>
        <p style={{ fontSize: 12, color: 'var(--text-light)', margin: '0 0 6px' }}>
          여기서 바로 새 시리즈를 만들 수 있습니다.
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            className="form-input"
            placeholder="새 시리즈 제목"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            style={{ flex: 1, fontSize: 13 }}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleCreate}
            disabled={creating || !newTitle.trim()}
          >
            {creating ? '...' : '만들기'}
          </button>
        </div>
      </div>
    </div>
  );
}
