import { useEffect } from 'react';

export default function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 2500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const bg = type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)';
  const color = type === 'error' ? 'var(--danger)' : 'var(--success)';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        background: bg,
        color,
        border: `1px solid ${color}`,
        borderRadius: 'var(--radius-sm)',
        padding: '10px 16px',
        fontSize: 13,
        boxShadow: 'var(--shadow)',
        zIndex: 9999,
        maxWidth: 320,
      }}
    >
      {message}
    </div>
  );
}
