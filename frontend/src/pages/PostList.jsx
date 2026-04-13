import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPosts } from '../api/posts';
import useInfiniteScroll from '../hooks/useInfiniteScroll';
import { useCategories } from '../context/CategoryContext';
import CategorySidebar from '../components/widgets/CategorySidebar';
import { useAuth } from '../hooks/useAuth';

function highlightText(text, q) {
  if (!q || !text) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === q.toLowerCase()
      ? <mark key={i} style={{ background: 'var(--accent-bg)', color: 'var(--accent-text)', borderRadius: 2 }}>{part}</mark>
      : part
  );
}

const isEditorOrAdmin = (user) =>
  user && (user.role === 'admin' || user.role === 'editor');

export default function PostList({ externalFilters = null, highlightQ = '' }) {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const { categories } = useCategories();
  const [categoryId, setCategoryId] = useState(null);
  const [inputQ, setInputQ] = useState('');
  const [q, setQ] = useState('');

  // 300ms 디바운스
  useEffect(() => {
    const timer = setTimeout(() => setQ(inputQ.trim()), 300);
    return () => clearTimeout(timer);
  }, [inputQ]);

  const fetchFn = useCallback(
    (page) => {
      if (externalFilters) {
        return listPosts(
          token, page, 20,
          externalFilters.q || '',
          externalFilters.categoryId || null,
          externalFilters.tagIds || [],
          externalFilters.author || ''
        );
      }
      return listPosts(token, page, 20, q, categoryId);
    },
    [token, q, categoryId, externalFilters]
  );
  const depsKey = externalFilters ? JSON.stringify(externalFilters) : `${token}-${q}-${categoryId}`;
  const { items: posts, loading, hasMore, error, sentinelRef } = useInfiniteScroll(fetchFn, [depsKey]);

  return (
    <div className="page-content">
      <div style={{ display: 'flex', gap: 24 }}>
        <aside style={{ width: 160, flexShrink: 0 }}>
          <CategorySidebar
            categories={categories}
            selectedId={categoryId}
            onSelect={(id) => { setCategoryId(id); }}
          />
        </aside>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h1 className="page-heading" style={{ margin: 0 }}>포스트</h1>
            {isEditorOrAdmin(user) && (
              <button className="btn btn-primary" onClick={() => navigate('/posts/new')}>
                + 새 글
              </button>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <input
              type="text"
              className="form-input"
              placeholder="포스트 검색..."
              value={inputQ}
              onChange={(e) => setInputQ(e.target.value)}
              style={{ width: '100%', maxWidth: 400 }}
            />
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {posts.length === 0 && !loading && !error ? (
            <div className="empty-state">
              <p style={{ fontSize: 32, marginBottom: 12 }}>📄</p>
              <p>{q ? `"${q}"에 대한 검색 결과가 없습니다.` : '게시된 포스트가 없습니다.'}</p>
            </div>
          ) : (
            <ul className="post-list">
              {posts.map((post) => (
                <li
                  key={post.id}
                  className="post-item"
                  onClick={() => navigate(`/posts/${post.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/posts/${post.id}`)}
                  role="button"
                  tabIndex={0}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="post-title">
                    {highlightQ ? highlightText(post.title, highlightQ) : post.title}
                  </div>
                  {post.excerpt && (
                    <div className="post-excerpt">
                      {highlightQ ? highlightText(post.excerpt, highlightQ) : post.excerpt}
                    </div>
                  )}
                  <div className="post-meta" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span>{post.author_username || '알 수 없음'}</span>
                    <span>·</span>
                    {post.created_at && (
                      <span>
                        {new Date(post.created_at).toLocaleDateString('ko-KR', {
                          year: 'numeric', month: 'long', day: 'numeric',
                        })}
                      </span>
                    )}
                    <span>·</span>
                    <span>👁 {post.view_count ?? 0}</span>
                    <span>·</span>
                    <span>💬 {post.comment_count ?? 0}</span>
                    <span>·</span>
                    <span>♥ {post.like_count ?? 0}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div ref={sentinelRef} style={{ height: 1 }} />
          {loading && (
            <div className="empty-state" style={{ marginTop: 24 }}>불러오는 중...</div>
          )}
          {!hasMore && posts.length > 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: 13, padding: '24px 0' }}>
              더 이상 글이 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
