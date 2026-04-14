export default function ConfirmDialog({ isOpen, message, onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div className="card" style={{ maxWidth: 360, width: '90%', padding: 24 }}>
        <p style={{ fontSize: 15, color: 'var(--text-h)', marginBottom: 20, lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onCancel}>취소</button>
          <button className="btn btn-danger" onClick={onConfirm}>확인</button>
        </div>
      </div>
    </div>
  );
}
