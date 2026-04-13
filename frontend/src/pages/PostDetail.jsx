import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getPost, likePost } from '../api/posts';
import 'react-quill-new/dist/quill.snow.css';
import MDEditor from '@uiw/react-md-editor';
import CommentSection from '../components/CommentSection';
import SeriesNav from '../components/SeriesNav';
import ShareButtons from '../components/ShareButtons';
import TagCloud from '../components/widgets/TagCloud';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { STATUS_BADGE } from '../constants/postStatus';

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { token, user } = useAuth();
  const { theme } = useTheme();
  const [likeCount, setLikeCount] = useState(0);
  const [userLiked, setUserLiked] = useState(false);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const postRes = await getPost(id, token);
        if (cancelled) return;

        if (!postRes.success) {
          setError('포스트를 찾을 수 없습니다.');
          setLoading(false);
          return;
        }

        setPost(postRes.data);
        setLikeCount(postRes.data.like_count ?? 0);
        setUserLiked(postRes.data.user_liked ?? false);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('포스트를 불러오는 중 오류가 발생했습니다.');
          setLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [id, token]);

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

      <ShareButtons title={post.title} />

      {/* 댓글 */}
      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '40px 0 0' }} />
      <CommentSection postId={post.id} user={user} />

      {/* 이전/다음 */}
      {(post.prev_post || post.next_post) && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '40px 0 20px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div>
              {post.prev_post && (
                <button className="btn btn-ghost" onClick={() => navigate(`/posts/${post.prev_post.id}`)}>
                  ← {post.prev_post.title}
                </button>
              )}
            </div>
            <div>
              {post.next_post && (
                <button className="btn btn-ghost" onClick={() => navigate(`/posts/${post.next_post.id}`)}>
                  {post.next_post.title} →
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
