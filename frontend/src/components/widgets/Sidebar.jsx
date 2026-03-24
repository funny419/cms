import RecentPosts from './RecentPosts';

export default function Sidebar() {
  return (
    <aside
      style={{
        width: '240px',
        flexShrink: 0,
        padding: '1rem',
        borderLeft: '1px solid var(--border)',
        background: 'var(--bg)',
      }}
    >
      <RecentPosts limit={5} />
    </aside>
  );
}
