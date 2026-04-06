import { useEffect, useState } from 'react';
import { listPosts } from '../../api/posts';

export default function RecentPosts({ limit = 5 }) {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    listPosts().then((res) => {
      if (res.success) {
        setPosts(res.data.items.slice(0, limit));
      }
    });
  }, [limit]);

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-h)' }}>
        최근 포스트
      </h3>
      {posts.length === 0 ? (
        <p style={{ color: 'var(--text)', fontSize: '0.875rem' }}>포스트가 없습니다.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {posts.map((post) => (
            <li
              key={post.id}
              style={{
                padding: '0.5rem 0',
                borderBottom: '1px solid var(--border)',
                fontSize: '0.875rem',
                color: 'var(--text)',
              }}
            >
              {post.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
