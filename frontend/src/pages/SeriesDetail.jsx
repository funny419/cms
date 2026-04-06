import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getUserSeries, getSeriesDetail } from '../api/series';

export default function SeriesDetail() {
  const { username, slug } = useParams();
  const navigate = useNavigate();
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // slug 또는 숫자 ID로 시리즈 조회
      const listRes = await getUserSeries(username);
      if (cancelled) return;
      if (!listRes.success) {
        setError(listRes.error || '시리즈를 불러오지 못했습니다.');
        setLoading(false);
        return;
      }
      const items = listRes.data.items || [];
      const found = items.find((s) => s.slug === slug || String(s.id) === slug);
      if (!found) {
        setError('시리즈를 찾을 수 없습니다.');
        setLoading(false);
        return;
      }
      const detailRes = await getSeriesDetail(found.id);
      if (cancelled) return;
      if (detailRes.success) {
        setSeries(detailRes.data);
      } else {
        setError(detailRes.error || '시리즈 상세 정보를 불러오지 못했습니다.');
      }
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [username, slug]);

  if (loading) {
    return <div className="page-content"><div className="empty-state" style={{ marginTop: 80 }}>불러오는 중...</div></div>;
  }

  if (error) {
    return (
      <div className="page-content">
        <div className="alert alert-error" style={{ marginTop: 40 }}>{error}</div>
        <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => navigate(`/blog/${username}`)}>
          블로그로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="page-content" style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 8 }}>
        <Link to={`/blog/${username}`} style={{ color: 'var(--text-light)', fontSize: 14 }}>
          ← {username}의 블로그
        </Link>
      </div>

      <div className="card" style={{ padding: '24px 28px', marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{series.title}</h1>
        {series.description && (
          <p style={{ color: 'var(--text-light)', fontSize: 15, lineHeight: 1.6 }}>{series.description}</p>
        )}
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-light)' }}>
          총 {series.total}편
        </div>
      </div>

      {series.posts && series.posts.length > 0 ? (
        <ul className="post-list">
          {series.posts.map((post, idx) => (
            <li
              key={post.id}
              className="post-item"
              onClick={() => navigate(`/posts/${post.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>
                {idx + 1}화
              </div>
              <div className="post-title">{post.title}</div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state">
          <p>이 시리즈에 포스트가 없습니다.</p>
        </div>
      )}
    </div>
  );
}
