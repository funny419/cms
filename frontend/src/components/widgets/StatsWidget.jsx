export default function StatsWidget({ profile }) {
  if (!profile) return null;
  const stats = [
    { label: '포스트', value: profile.post_count ?? 0 },
    { label: '총 조회수', value: (profile.total_view_count ?? 0).toLocaleString() },
    { label: '총 댓글', value: profile.total_comment_count ?? 0 },
    { label: '팔로워', value: profile.follower_count ?? 0 },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 24 }}>
      {stats.map(({ label, value }) => (
        <div key={label} className="card" style={{ padding: '12px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
          <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}
