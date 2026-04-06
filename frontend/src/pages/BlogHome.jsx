import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getUserProfile, getUserPosts, followUser, unfollowUser } from '../api/users';
import useInfiniteScroll from '../hooks/useInfiniteScroll';
import ProfileCard from '../components/ProfileCard';
import StatsWidget from '../components/widgets/StatsWidget';
import BlogLayoutDefault from '../components/layouts/BlogLayoutDefault';
import BlogLayoutCompact from '../components/layouts/BlogLayoutCompact';
import BlogLayoutMagazine from '../components/layouts/BlogLayoutMagazine';
import BlogLayoutPhoto from '../components/layouts/BlogLayoutPhoto';
import { getCategories } from '../api/categories';
import { getUserSeries } from '../api/series';
import { useAuth } from '../hooks/useAuth';

export default function BlogHome() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { token, user: currentUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(null);
  const [seriesList, setSeriesList] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [profileRes, catRes, seriesRes] = await Promise.all([
        getUserProfile(username),
        getCategories(),
        getUserSeries(username),
      ]);
      if (cancelled) return;
      if (profileRes.success) {
        setProfile(profileRes.data);
        setIsFollowing(profileRes.data.is_following || false);
      } else {
        setProfileError(profileRes.error || '사용자를 찾을 수 없습니다.');
      }
      if (catRes.success) setCategories(catRes.data.items || []);
      if (seriesRes.success) setSeriesList(seriesRes.data.items || []);
      setProfileLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [username]);

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

  const layout = profile?.blog_layout || 'default';
  const accentColor = profile?.blog_color || '#7c3aed';
  const LAYOUTS = {
    compact:  { component: BlogLayoutCompact,  maxWidth: 720, extraProps: {} },
    magazine: { component: BlogLayoutMagazine, maxWidth: 800, extraProps: { accentColor } },
    photo:    { component: BlogLayoutPhoto,    maxWidth: 960, extraProps: { accentColor } },
    default:  { component: BlogLayoutDefault,  maxWidth: 900, extraProps: { categories, categoryId, setCategoryId } },
  };
  const { component: LayoutComponent, maxWidth, extraProps } = LAYOUTS[layout] || LAYOUTS.default;

  return (
    <div className="page-content" style={{ maxWidth }}>
      <ProfileCard
        user={profile}
        blogColor={accentColor}
        onFollow={handleFollow}
        isFollowing={isFollowing}
        isOwnBlog={isOwnBlog}
      />

      <StatsWidget profile={profile} />

      <LayoutComponent
        posts={filteredPosts}
        loading={loading}
        hasMore={hasMore}
        sentinelRef={sentinelRef}
        {...extraProps}
      />

      {seriesList.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--text-h)' }}>
            시리즈
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {seriesList.map((s) => (
              <div
                key={s.id}
                className="card"
                style={{ padding: '16px', cursor: 'pointer' }}
                onClick={() => navigate(`/blog/${username}/series/${s.slug || s.id}`)}
              >
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, color: 'var(--text-h)' }}>
                  {s.title}
                </div>
                {s.description && (
                  <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 8, lineHeight: 1.5 }}>
                    {s.description}
                  </div>
                )}
                <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
                  포스트 {s.total ?? 0}개
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
