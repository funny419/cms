import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyStats } from '../api/stats';
import { getUserProfile } from '../api/users';
import StatsWidget from '../components/widgets/StatsWidget';
import { useAuth } from '../hooks/useAuth';

const LazyLineChart = lazy(() =>
  import('recharts').then((m) => ({
    default: function ViewChart({ data }) {
      const { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } = m;
      return (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="views"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={false}
              name="조회수"
            />
          </LineChart>
        </ResponsiveContainer>
      );
    },
  }))
);

const PERIODS = [
  { label: '7일', value: '7d' },
  { label: '30일', value: '30d' },
  { label: '90일', value: '90d' },
];

export default function Statistics() {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [period, setPeriod] = useState('7d');
  const [stats, setStats] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !user) { navigate('/login'); return; }
    if (user.role !== 'editor' && user.role !== 'admin') { navigate('/posts'); return; }
  }, []);

  useEffect(() => {
    if (!token || !user) return;
    let cancelled = false;
    const load = async () => {
      if (stats) setPeriodLoading(true); // 재조회 시 오버레이
      else setLoading(true);
      const [statsRes, profileRes] = await Promise.all([
        getMyStats(token, user.username, period),
        getUserProfile(user.username),
      ]);
      if (cancelled) return;
      if (statsRes.success) setStats(statsRes.data);
      else setError(statsRes.error);
      if (profileRes.success) setProfile(profileRes.data);
      setLoading(false);
      setPeriodLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const summaryProfile = profile ? {
    post_count: profile.post_count ?? 0,
    total_view_count: stats?.total_views ?? profile.total_view_count ?? 0,
    total_comment_count: profile.total_comment_count ?? 0,
    follower_count: profile.follower_count ?? 0,
  } : null;

  const dailyViews = stats?.daily_views || [];
  const topPosts = stats?.top_posts || [];
  const maxViews = topPosts.length > 0 ? Math.max(...topPosts.map((p) => p.view_count)) : 1;

  return (
    <div className="page-content" style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-h)' }}>블로그 통계</h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              style={{
                padding: '4px 14px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: period === p.value ? 'var(--accent-bg)' : 'transparent',
                color: period === p.value ? 'var(--accent-text)' : 'var(--text)',
                fontWeight: period === p.value ? 600 : 400,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <StatsWidget profile={summaryProfile} />

      {/* 일별 조회수 차트 */}
      <div className="card" style={{ padding: 20, marginBottom: 24, position: 'relative' }}>
        {periodLoading && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 'var(--radius)',
            background: 'rgba(var(--bg-rgb, 255,255,255), 0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1,
          }}>
            <span style={{
              width: 20, height: 20, border: '2px solid var(--border)',
              borderTopColor: 'var(--accent)', borderRadius: '50%',
              display: 'inline-block', animation: 'spin 0.7s linear infinite',
            }} />
          </div>
        )}
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--text-h)' }}>
          일별 조회수
        </h2>
        {loading ? (
          <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-light)', fontSize: 13 }}>
            불러오는 중...
          </div>
        ) : dailyViews.length === 0 ? (
          <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-light)', fontSize: 13 }}>
            데이터가 없습니다.
          </div>
        ) : (
          <Suspense fallback={<div style={{ height: 240 }} />}>
            <LazyLineChart data={dailyViews} />
          </Suspense>
        )}
      </div>

      {/* Top 10 인기 포스트 */}
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--text-h)' }}>
          인기 포스트 Top 10
        </h2>
        {loading ? (
          <div style={{ color: 'var(--text-light)', fontSize: 13 }}>불러오는 중...</div>
        ) : topPosts.length === 0 ? (
          <div style={{ color: 'var(--text-light)', fontSize: 13 }}>데이터가 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topPosts.map((p) => (
              <div key={p.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                  <span
                    style={{ color: 'var(--text)', cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '70%' }}
                    onClick={() => navigate(`/posts/${p.id}`)}
                  >
                    {p.title}
                  </span>
                  <span style={{ color: 'var(--text-light)', flexShrink: 0, marginLeft: 8 }}>
                    👁 {p.view_count.toLocaleString()}
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-subtle)', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 3,
                      background: 'var(--accent)',
                      width: `${Math.round((p.view_count / maxViews) * 100)}%`,
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
