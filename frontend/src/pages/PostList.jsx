import { useEffect, useState } from 'react';
import { listPosts } from '../api/posts';

export default function PostList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listPosts().then((res) => {
      if (res.success) {
        setPosts(res.data);
      } else {
        setError(res.error);
      }
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-10 text-center">로딩 중...</div>;
  if (error) return <div className="p-10 text-center text-red-500">{error}</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">포스트 목록</h1>
      {posts.length === 0 ? (
        <p className="text-gray-500">게시된 포스트가 없습니다.</p>
      ) : (
        <ul className="space-y-4">
          {posts.map((post) => (
            <li key={post.id} className="border rounded-lg p-4 shadow-sm">
              <h2 className="text-lg font-semibold">{post.title}</h2>
              {post.excerpt && <p className="text-gray-600 mt-1 text-sm">{post.excerpt}</p>}
              <p className="text-xs text-gray-400 mt-2">{post.created_at}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
