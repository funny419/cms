import { useEffect, useState } from 'react';
import { listPosts } from '../api/posts';

export default function PostList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listPosts().then((res) => {
      if (res.success) setPosts(res.data);
      else setError(res.error);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="empty-state" style={{ marginTop: 80 }}>불러오는 중...</div>
  );

  if (error) return (
    <div className="page-content">
      <div className="alert alert-error">{error}</div>
    </div>
  );

  return (
    <div className="page-content">
      <h1 className="page-heading">포스트</h1>

      {posts.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 32, marginBottom: 12 }}>📄</p>
          <p>게시된 포스트가 없습니다.</p>
        </div>
      ) : (
        <ul className="post-list">
          {posts.map((post) => (
            <li key={post.id} className="post-item">
              <div className="post-title">{post.title}</div>
              {post.excerpt && (
                <div className="post-excerpt">{post.excerpt}</div>
              )}
              <div className="post-meta">
                {post.created_at
                  ? new Date(post.created_at).toLocaleDateString('ko-KR', {
                      year: 'numeric', month: 'long', day: 'numeric',
                    })
                  : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
