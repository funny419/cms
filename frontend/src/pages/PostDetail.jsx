import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getPost, listPosts, likePost } from '../api/posts';
import 'react-quill-new/dist/quill.snow.css';
import MDEditor from '@uiw/react-md-editor';
import CommentSection from '../components/CommentSection';
import SeriesNav from '../components/SeriesNav';
import TagCloud from '../components/widgets/TagCloud';
import { useTheme } from '../context/ThemeContext';

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
  const { theme } = useTheme();
  const token = localStorage.getItem('token');
  const [likeCount, setLikeCount] = useState(0);
  const [userLiked, setUserLiked] = useState(false);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [postRes, listRes] = await Promise.all([
          getPost(id, token),
          listPosts(token),
        ]);

        if (!postRes.success) {
          setError('포스트를 찾을 수 없습니다.');
          setLoading(false);
          return;
        }

        setPost(postRes.data);
        setLikeCount(postRes.data.like_count ?? 0);
        setUserLiked(postRes.data.user_liked ?? false);

        if (listRes.success) {
          // created_at 내림차순 (최신 글이 앞)
          const sorted = [...listRes.data.items].sort(
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

  const handleLike = async () => {
    if (!token || !user) return;
    setLiking(true);
    const res = await likePost(token, post.id);
    setLiking(false);
    if (res.success) {
      setLikeCount(res.data.like_count);
      setUserLiked(res.data.liked);
    }
  };

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

      {/* 메타 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13, color: 'var(--text-light)', flexWrap: 'wrap' }}>
        {post.author_username && <span>{post.author_username}</span>}
        {post.author_username && dateStr && <span>·</span>}
        {dateStr && <span>{dateStr}</span>}
        {dateStr && <span>·</span>}
        <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500, ...badge.style }}>
          {badge.label}
        </span>
        <span>·</span>
        <span>👁 {post.view_count ?? 0}</span>

        {/* 추천 버튼 */}
        <button
          onClick={handleLike}
          disabled={
            liking ||
            !token ||
            !user ||
            post.author_id === user?.id
          }
          title={
            !token || !user
              ? '로그인 후 추천할 수 있습니다'
              : post.author_id === user?.id
              ? '본인 글은 추천할 수 없습니다'
              : userLiked
              ? '추천 취소'
              : '추천'
          }
          style={{
            marginLeft: 4,
            padding: '2px 10px',
            borderRadius: 99,
            border: '1px solid var(--border)',
            background: userLiked ? 'var(--accent-bg)' : 'transparent',
            color: userLiked ? 'var(--accent-text)' : 'var(--text-light)',
            cursor: (!token || !user || post.author_id === user?.id) ? 'default' : 'pointer',
            fontSize: 12,
            fontWeight: 500,
            transition: 'all 0.15s',
          }}
        >
          ♥ {likeCount}
        </button>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: 28 }} />

      {/* 본문 */}
      {post.content_format === 'markdown' ? (
        <div data-color-mode={theme === 'dark' ? 'dark' : 'light'} style={{ fontSize: 15, lineHeight: 1.8 }}>
          <MDEditor.Markdown source={post.content || ''} />
        </div>
      ) : (
        <div className="ql-snow">
          <div
            className="ql-editor"
            style={{ padding: 0, fontSize: 15, lineHeight: 1.8, color: 'var(--text-h)' }}
            dangerouslySetInnerHTML={{ __html: post.content || '' }}
          />
        </div>
      )}

      {/* 태그 */}
      {post.tags && post.tags.length > 0 && (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 8 }}>태그</p>
          <TagCloud tags={post.tags} />
        </div>
      )}

      {/* 시리즈 네비게이션 */}
      {post.series && (
        <SeriesNav series={post.series} currentPostId={post.id} />
      )}

      {/* 댓글 */}
      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '40px 0 0' }} />
      <CommentSection postId={post.id} user={user} />

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
