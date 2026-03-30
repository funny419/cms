import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getUserProfile } from '../api/users';
import { listPosts } from '../api/posts';
import useInfiniteScroll from '../hooks/useInfiniteScroll';

export default function BlogHome() {
  const { username } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setProfile(null);
      setProfileLoading(true);
      setProfileError('');
      const res = await getUserProfile(username);
      if (cancelled) return;
      if (res.success) {
        setProfile(res.data);
      } else {
        setProfileError(res.error || '사용자를 찾을 수 없습니다.');
      }
      setProfileLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [username]);

  const fetchFn = useCallback(
    (page) => listPosts(token, page, 20, ''),
    [token]
  );
  const { items: posts, loading, hasMore, sentinelRef } = useInfiniteScroll(
    fetchFn,
    [token]
  );

  // 해당 username 포스트만 필터 (임시 — Task 9에서 BE author 필터로 교체)
  const userPosts = posts.filter((p) => p.author_username === username);

  if (profileLoading) return (
    <div className="empty-state" style={{ marginTop: 80 }}>불러오는 중...</div>
  );

  if (profileError) return (
    <div className="page-content">
      <div className="alert alert-error">{profileError}</div>
    </div>
  );

  return (
    <div className="page-content" style={{ maxWidth: 800 }}>
      {/* 프로필 헤더 */}
      <div style={{
        display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 32,
        padding: 24, background: 'var(--bg-subtle)', borderRadius: 12,
      }}>
        {profile.avatar_url && (
          <img
            src={profile.avatar_url}
            alt={profile.username}
            style={{
              width: 64, height: 64, borderRadius: '50%', objectFit: 'cover',
              border: '2px solid var(--border)', flexShrink: 0,
            }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        )}
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            {profile.username}의 블로그
          </h1>
          {profile.bio && (
            <p style={{ color: 'var(--text-light)', fontSize: 14, marginBottom: 8 }}>
              {profile.bio}
            </p>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-light)' }}>
            포스트 {profile.post_count}개
          </span>
        </div>
      </div>

      {/* 포스트 목록 */}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>최근 글</h2>

      {userPosts.length === 0 && !loading ? (
        <div className="empty-state"><p>게시된 글이 없습니다.</p></div>
      ) : (
        <ul className="post-list">
          {userPosts.map((post) => (
            <li
              key={post.id}
              className="post-item"
              onClick={() => navigate(`/posts/${post.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <div className="post-title">{post.title}</div>
              {post.excerpt && <div className="post-excerpt">{post.excerpt}</div>}
              <div className="post-meta">
                <span>
                  {new Date(post.created_at).toLocaleDateString('ko-KR', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </span>
                <span>·</span>
                <span>👁 {post.view_count ?? 0}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div ref={sentinelRef} style={{ height: 1 }} />
      {loading && (
        <div className="empty-state" style={{ marginTop: 24 }}>불러오는 중...</div>
      )}
      {!hasMore && userPosts.length > 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: 13, padding: '24px 0' }}>
          더 이상 글이 없습니다.
        </div>
      )}
    </div>
  );
}
