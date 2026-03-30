import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getUserProfile, getUserPosts } from '../api/users';
import useInfiniteScroll from '../hooks/useInfiniteScroll';
import ProfileCard from '../components/ProfileCard';
import CategorySidebar from '../components/widgets/CategorySidebar';
import TagCloud from '../components/widgets/TagCloud';
import { getCategories } from '../api/categories';

export default function BlogHome() {
  const { username } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [profileRes, catRes] = await Promise.all([
        getUserProfile(username),
        getCategories(),
      ]);
      if (cancelled) return;
      if (profileRes.success) {
        setProfile(profileRes.data);
      } else {
        setProfileError(profileRes.error || '사용자를 찾을 수 없습니다.');
      }
      if (catRes.success) setCategories(catRes.data.items || []);
      setProfileLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [username]);

  const fetchFn = useCallback(
    (page) => getUserPosts(username, token, page, 20),
    [username, token]
  );
  const { items: posts, loading, hasMore, sentinelRef } = useInfiniteScroll(
    fetchFn,
    [username, token]
  );

  // 카테고리 필터 (FE 필터링)
  const filteredPosts = categoryId
    ? posts.filter((p) => p.category_id === categoryId)
    : posts;

  if (profileLoading) return (
    <div className="empty-state" style={{ marginTop: 80 }}>불러오는 중...</div>
  );

  if (profileError) return (
    <div className="page-content">
      <div className="alert alert-error">{profileError}</div>
    </div>
  );

  return (
    <div className="page-content" style={{ maxWidth: 900 }}>
      <ProfileCard user={profile} />

      <div style={{ display: 'flex', gap: 32 }}>
        {/* 사이드바 */}
        <aside style={{ width: 160, flexShrink: 0 }}>
          <CategorySidebar
            categories={categories}
            selectedId={categoryId}
            onSelect={setCategoryId}
          />
        </aside>

        {/* 포스트 목록 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            {categoryId
              ? `${categories.find((c) => c.id === categoryId)?.name || '카테고리'} 글`
              : '최근 글'}
          </h2>

          {filteredPosts.length === 0 && !loading ? (
            <div className="empty-state"><p>게시된 글이 없습니다.</p></div>
          ) : (
            <ul className="post-list">
              {filteredPosts.map((post) => (
                <li
                  key={post.id}
                  className="post-item"
                  onClick={() => navigate(`/posts/${post.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="post-title">{post.title}</div>
                  {post.excerpt && <div className="post-excerpt">{post.excerpt}</div>}
                  {post.tags && post.tags.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <TagCloud tags={post.tags} />
                    </div>
                  )}
                  <div className="post-meta">
                    <span>
                      {new Date(post.created_at).toLocaleDateString('ko-KR', {
                        year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </span>
                    <span>·</span>
                    <span>👁 {post.view_count ?? 0}</span>
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
          {!hasMore && filteredPosts.length > 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: 13, padding: '24px 0' }}>
              더 이상 글이 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
