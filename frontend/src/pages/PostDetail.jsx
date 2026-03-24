import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getPost, listPosts } from '../api/posts';
import 'react-quill-new/dist/quill.snow.css';

const getUser = () => {
  try { return JSON.parse(localStorage.getItem('user')); }
  catch { return null; }
};
const STATUS_BADGE = {
  published: {
    label: '발행됨',
    style: { background: 'var(--accent-bg)', color: 'var(--accent-text)' },
  },
  draft: {
    label: '임시저장',
    style: { background: 'var(--bg-subtle)', color: 'var(--text-light)' },
  },
  scheduled: {
    label: '예약됨',
    style: { background: '#fef3c7', color: '#92400e' },
  },
};

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [prev, setPrev] = useState(null);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = getUser();

  useEffect(() => {
    const load = async () => {
      try {
        const [postRes, listRes] = await Promise.all([
          getPost(id),
          listPosts(),
        ]);

        if (!postRes.success) {
          setError('포스트를 찾을 수 없습니다.');
          setLoading(false);
          return;
        }

        setPost(postRes.data);

        if (listRes.success) {
          // created_at 내림차순 (최신 글이 앞)
          const sorted = [...listRes.data].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
          );
          const idx = sorted.findIndex((p) => p.id === postRes.data.id);
          if (idx > 0) setPrev(sorted[idx - 1]);
          if (idx < sorted.length - 1) setNext(sorted[idx + 1]);
        }

        setLoading(false);
      } catch {
        setError('포스트를 불러오는 중 오류가 발생했습니다.');
        setLoading(false);
      }
    };

    load();
  }, [id]);

  if (loading) return (
    <div className="empty-state" style={{ marginTop: 80 }}>불러오는 중...</div>
  );

  if (error) return (
    <div className="page-content">
      <div className="alert alert-error">{error}</div>
      <Link to="/posts" className="text-link">← 목록으로</Link>
    </div>
  );

  const badge = STATUS_BADGE[post.status] || STATUS_BADGE.draft;
  const dateStr = post.created_at
    ? new Date(post.created_at).toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : '';

  return (
    <div className="page-content">
      {/* 상단 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Link to="/posts" className="text-link">← 포스트 목록</Link>
        {user && (user.role === 'admin' || post.author_id === user.id) && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: 13 }}
            onClick={() => navigate(`/posts/${id}/edit`)}
          >
            ✏️ 편집
          </button>
        )}
      </div>

      {/* 제목 */}
      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-h)', marginBottom: 8, lineHeight: 1.3 }}>
        {post.title}
      </h1>

      {/* 메타 — API가 author_id(숫자)만 반환하고 이름 없음, 작성자 표시 생략 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13, color: 'var(--text-light)' }}>
        {dateStr && <span>{dateStr}</span>}
        {dateStr && <span>·</span>}
        <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500, ...badge.style }}>
          {badge.label}
        </span>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: 28 }} />

      {/* 본문 — Quill 렌더링 */}
      <div className="ql-snow">
        <div
          className="ql-editor"
          style={{ padding: 0, fontSize: 15, lineHeight: 1.8, color: 'var(--text-h)' }}
          dangerouslySetInnerHTML={{ __html: post.content || '' }}
        />
      </div>

      {/* 이전/다음 */}
      {(prev || next) && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '40px 0 20px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div>
              {prev && (
                <button className="btn btn-ghost" onClick={() => navigate(`/posts/${prev.id}`)}>
                  ← {prev.title}
                </button>
              )}
            </div>
            <div>
              {next && (
                <button className="btn btn-ghost" onClick={() => navigate(`/posts/${next.id}`)}>
                  {next.title} →
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
