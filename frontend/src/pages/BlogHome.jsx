import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getUserProfile, getUserPosts, followUser, unfollowUser } from '../api/users';
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
  const [isFollowing, setIsFollowing] = useState(false);
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
        setIsFollowing(profileRes.data.is_following || false);
      } else {
        setProfileError(profileRes.error || '사용자를 찾을 수 없습니다.');
      }
      if (catRes.success) setCategories(catRes.data.items || []);
      setProfileLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [username]);

  const getUser = () => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  };
  const currentUser = getUser();
  const isOwnBlog = currentUser?.username === username;

  const handleFollow = async () => {
    if (!token) { navigate('/login'); return; }
    const res = isFollowing
      ? await unfollowUser(token, username)
      : await followUser(token, username);
    if (res.success) {
      setIsFollowing(res.data.following);
      setProfile((prev) => ({
        ...prev,
        follower_count: (prev.follower_count || 0) + (res.data.following ? 1 : -1),
      }));
    }
  };

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

  const isCompact = profile?.blog_layout === 'compact';

  return (
    <div className="page-content" style={{ maxWidth: isCompact ? 720 : 900 }}>
      <ProfileCard
        user={profile}
        blogColor={profile?.blog_color}
        onFollow={handleFollow}
        isFollowing={isFollowing}
        isOwnBlog={isOwnBlog}
      />

      {/* 블로그 통계 위젯 */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 24,
        border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden',
      }}>
        {[
          { label: '포스트', value: profile.post_count ?? 0 },
          { label: '총 조회수', value: (profile.total_view_count ?? 0).toLocaleString() },
          { label: '총 댓글', value: profile.total_comment_count ?? 0 },
        ].map(({ label, value }, i, arr) => (
          <div
            key={label}
            style={{
              flex: 1, padding: '14px 0', textAlign: 'center',
              borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
              background: 'var(--bg-subtle)',
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 32 }}>
        {/* 사이드바 (기본 레이아웃만) */}
        {!isCompact && (
          <aside style={{ width: 160, flexShrink: 0 }}>
            <CategorySidebar
              categories={categories}
              selectedId={categoryId}
              onSelect={setCategoryId}
            />
          </aside>
        )}

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
