import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * SeriesNav — 포스트 시리즈 네비게이션
 * Props:
 *   series: { id, title, slug, posts: [{id, title, order}] } | null
 *   currentPostId: number
 */
export default function SeriesNav({ series, currentPostId }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!series || !series.posts || series.posts.length === 0) return null;

  const sorted = [...series.posts].sort((a, b) => a.order - b.order);
  const currentIndex = sorted.findIndex((p) => p.id === currentPostId);
  const prev = currentIndex > 0 ? sorted[currentIndex - 1] : null;
  const next = currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : null;

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 10,
      overflow: 'hidden', margin: '32px 0',
    }}>
      {/* 헤더 */}
      <div style={{
        padding: '12px 16px', background: 'var(--bg-subtle)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-light)', marginBottom: 2 }}>시리즈</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{series.title}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-light)' }}>
            {currentIndex + 1} / {sorted.length}
          </span>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? '목차 닫기 ▲' : '목차 보기 ▼'}
          </button>
        </div>
      </div>

      {/* 목차 accordion */}
      {open && (
        <ul style={{ margin: 0, padding: '8px 0', listStyle: 'none' }}>
          {sorted.map((p, i) => (
            <li
              key={p.id}
              onClick={() => p.id !== currentPostId && navigate(`/posts/${p.id}`)}
              style={{
                padding: '8px 16px', fontSize: 14, cursor: p.id !== currentPostId ? 'pointer' : 'default',
                background: p.id === currentPostId ? 'var(--accent-bg)' : 'transparent',
                color: p.id === currentPostId ? 'var(--accent-text)' : 'var(--text)',
                fontWeight: p.id === currentPostId ? 600 : 400,
                borderLeft: p.id === currentPostId ? '3px solid var(--accent)' : '3px solid transparent',
              }}
            >
              {i + 1}. {p.title}
            </li>
          ))}
        </ul>
      )}

      {/* 이전/다음 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', padding: '10px 16px',
        borderTop: '1px solid var(--border)', gap: 8,
      }}>
        <div>
          {prev && (
            <button className="btn btn-ghost" style={{ fontSize: 13 }} aria-label="이전 시리즈 포스트" onClick={() => navigate(`/posts/${prev.id}`)}>
              ← {prev.title}
            </button>
          )}
        </div>
        <div>
          {next && (
            <button className="btn btn-ghost" style={{ fontSize: 13 }} aria-label="다음 시리즈 포스트" onClick={() => navigate(`/posts/${next.id}`)}>
              {next.title} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
