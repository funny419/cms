import { useState } from 'react';
import { getUserSeries } from '../../api/series';
import { useFetch } from '../../hooks/useFetch';

/**
 * SeriesDropdown — 시리즈 단일 선택 셀렉트
 * Props:
 *   value: number | null
 *   onChange: (seriesId: number | null) => void
 *   username: string (현재 로그인 유저의 username)
 */
export default function SeriesDropdown({ value = null, onChange, username }) {
  const [series, setSeries] = useState([]);

  useFetch(
    () => username ? getUserSeries(username) : null,
    (res) => { if (res.success) setSeries(res.data.items || []); },
    [username]
  );

  return (
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
  );
}
