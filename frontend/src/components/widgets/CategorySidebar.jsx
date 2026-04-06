/**
 * CategorySidebar — 카테고리 필터 사이드바
 * Props:
 *   categories: [{ id, name, parent_id, post_count }]
 *   selectedId: number | null
 *   onSelect: (id: number | null) => void
 */
export default function CategorySidebar({ categories = [], selectedId, onSelect }) {
  if (!categories.length) return null;

  const roots = categories.filter((c) => !c.parent_id);
  const getChildren = (parentId) => categories.filter((c) => c.parent_id === parentId);
  const totalCount = categories.reduce((s, c) => s + (c.post_count || 0), 0);

  const btnStyle = (active) => ({
    background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
    fontSize: 14, textAlign: 'left', width: '100%',
    color: active ? 'var(--accent)' : 'var(--text)',
    fontWeight: active ? 600 : 400,
  });

  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{
        fontSize: 12, fontWeight: 600, color: 'var(--text-light)',
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
      }}>
        카테고리
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        <li>
          <button onClick={() => onSelect(null)} style={btnStyle(selectedId == null)}>
            전체 ({totalCount})
          </button>
        </li>
        {roots.map((cat) => (
          <li key={cat.id}>
            <button onClick={() => onSelect(cat.id)} style={btnStyle(selectedId === cat.id)}>
              {cat.name} ({cat.post_count || 0})
            </button>
            {getChildren(cat.id).map((child) => (
              <button
                key={child.id}
                onClick={() => onSelect(child.id)}
                style={{ ...btnStyle(selectedId === child.id), paddingLeft: 16, fontSize: 13,
                  color: selectedId === child.id ? 'var(--accent)' : 'var(--text-light)' }}
              >
                {'\u2514'} {child.name} ({child.post_count || 0})
              </button>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
