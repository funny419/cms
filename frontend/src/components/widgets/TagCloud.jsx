import { useNavigate } from 'react-router-dom';

/**
 * TagCloud — 태그 목록을 chip 형태로 표시
 * Props:
 *   tags: [{ id, name, slug, post_count? }]
 */
export default function TagCloud({ tags = [] }) {
  const navigate = useNavigate();
  if (!tags.length) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="badge"
          onClick={() => navigate(`/posts?tag=${tag.id}`)}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          #{tag.name}
          {tag.post_count > 0 && (
            <span style={{ marginLeft: 4, opacity: 0.7 }}>({tag.post_count})</span>
          )}
        </span>
      ))}
    </div>
  );
}
