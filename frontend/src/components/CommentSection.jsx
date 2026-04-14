// frontend/src/components/CommentSection.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { listComments, createComment, updateComment, deleteComment } from '../api/comments';
import ConfirmDialog from './ConfirmDialog';

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

// 게스트 정보를 localStorage에서 관리
const getGuestEmail = () => localStorage.getItem('guest_email') || '';
const setGuestEmail = (email) => localStorage.setItem('guest_email', email);
const getGuestName = () => localStorage.getItem('guest_name') || '';
const setGuestName = (name) => localStorage.setItem('guest_name', name);

// ─── 댓글 작성 폼 ─────────────────────────────────────────────
function CommentForm({ token, postId, parentId = null, onSuccess, onCancel }) {
  const isLoggedIn = !!token;
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState(getGuestEmail());
  const [authorPassword, setAuthorPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError('');

    const data = isLoggedIn
      ? { content: content.trim(), parent_id: parentId || undefined }
      : { content: content.trim(), parent_id: parentId || undefined,
          author_name: authorName.trim(), author_email: authorEmail.trim(),
          author_password: authorPassword };

    const res = await createComment(token, postId, data);
    setSubmitting(false);
    if (res.success) {
      if (!isLoggedIn) {
        setGuestEmail(authorEmail.trim());
        setGuestName(authorName.trim());
      }
      setContent('');
      setAuthorPassword('');
      onSuccess(res.data);
    } else {
      setError(res.error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {!isLoggedIn && (
        <div className="guest-form-grid">
          <div>
            <label htmlFor={`guest-name-${parentId ?? 'root'}`} style={{ position: 'absolute', width: 1, height: 1, padding: 0, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>이름</label>
            <input id={`guest-name-${parentId ?? 'root'}`} className="form-input" placeholder="이름 *" value={authorName}
              onChange={(e) => setAuthorName(e.target.value)} required />
          </div>
          <div>
            <label htmlFor={`guest-email-${parentId ?? 'root'}`} style={{ position: 'absolute', width: 1, height: 1, padding: 0, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>이메일</label>
            <input id={`guest-email-${parentId ?? 'root'}`} className="form-input" type="email" placeholder="이메일 *" value={authorEmail}
              onChange={(e) => setAuthorEmail(e.target.value)} required />
          </div>
          <div>
            <label htmlFor={`guest-password-${parentId ?? 'root'}`} style={{ position: 'absolute', width: 1, height: 1, padding: 0, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>패스워드</label>
            <input id={`guest-password-${parentId ?? 'root'}`} className="form-input" type="password" placeholder="패스워드 * (수정/삭제에 사용)" value={authorPassword}
              onChange={(e) => setAuthorPassword(e.target.value)} required />
          </div>
        </div>
      )}
      <textarea
        className="form-input"
        rows={3}
        placeholder={parentId ? '답글을 입력하세요...' : '댓글을 입력하세요...'}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={2000}
        style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
      />
      {!isLoggedIn && (
        <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>
          게스트 댓글은 관리자 승인 후 표시됩니다.
        </p>
      )}
      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 4 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={submitting || !content.trim()}>
          {submitting ? '등록 중...' : '등록'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>취소</button>
        )}
      </div>
    </form>
  );
}

// ─── 댓글 수정 폼 ─────────────────────────────────────────────
function EditForm({ comment, token, onSuccess, onCancel }) {
  const isLoggedIn = !!token;
  const [content, setContent] = useState(comment.content);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError('');

    const data = isLoggedIn
      ? { content: content.trim() }
      : { content: content.trim(), author_email: getGuestEmail(), author_password: password };

    const res = await updateComment(token, comment.id, data);
    setSubmitting(false);
    if (res.success) onSuccess(res.data);
    else setError(res.error);
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 8 }}>
      <textarea
        className="form-input"
        rows={3}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={2000}
        style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
      />
      {!isLoggedIn && (
        <input className="form-input" type="password" placeholder="패스워드 입력"
          value={password} onChange={(e) => setPassword(e.target.value)}
          style={{ marginTop: 6, width: '100%' }} required />
      )}
      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 4 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? '저장 중...' : '저장'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>취소</button>
      </div>
    </form>
  );
}

// ─── 삭제 확인 폼 (게스트 전용) ───────────────────────────────
function GuestDeleteForm({ comment, onSuccess, onCancel }) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const res = await deleteComment(null, comment.id,
      { author_email: getGuestEmail(), author_password: password });
    setSubmitting(false);
    if (res.success) onSuccess();
    else setError(res.error);
  };

  return (
    <form onSubmit={handleDelete} style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
      <input className="form-input" type="password" placeholder="패스워드 확인"
        value={password} onChange={(e) => setPassword(e.target.value)} style={{ flex: 1 }} />
      <button type="submit" className="btn btn-danger" disabled={submitting}>
        {submitting ? '삭제 중...' : '삭제 확인'}
      </button>
      <button type="button" className="btn btn-ghost" onClick={onCancel}>취소</button>
      {error && <span style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</span>}
    </form>
  );
}

// ─── 답글 아이템 ──────────────────────────────────────────────
function ReplyItem({ reply, token, user, onRefresh }) {
  const [editMode, setEditMode] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const guestEmail = getGuestEmail();
  const guestName = getGuestName();
  const isLoggedIn = !!token && !!user;
  const isOwner = isLoggedIn
    ? (user.role === 'admin' || reply.author_id === user.id)
    : (reply.author_id === null && guestEmail !== '' && reply.author_name === guestName);

  const handleLoggedInDelete = () => {
    setConfirmOpen(true);
  };

  const doLoggedInDelete = async () => {
    const res = await deleteComment(token, reply.id);
    if (res.success) onRefresh();
  };

  return (
    <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: 12, marginBottom: 12 }}>
      <ConfirmDialog
        isOpen={confirmOpen}
        message="답글을 삭제할까요?"
        onConfirm={() => { setConfirmOpen(false); doLoggedInDelete(); }}
        onCancel={() => setConfirmOpen(false)}
      />
      {editMode ? (
        <EditForm
          comment={reply}
          token={token}
          onSuccess={() => { setEditMode(false); onRefresh(); }}
          onCancel={() => setEditMode(false)}
        />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-h)' }}>{reply.author_name}</span>
              {reply.author_id === null && (
                <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-light)',
                  background: 'var(--bg-subtle)', padding: '1px 6px', borderRadius: 99 }}>
                  게스트
                </span>
              )}
              <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-light)' }}>
                {formatDate(reply.created_at)}
              </span>
              <p style={{ marginTop: 4, fontSize: 13, lineHeight: 1.7, color: 'var(--text-h)', whiteSpace: 'pre-wrap' }}>
                {reply.content}
              </p>
            </div>
            {isOwner && !deleteMode && (
              <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '2px 8px' }}
                  onClick={() => setEditMode(true)}>수정</button>
                {isLoggedIn ? (
                  <button className="btn btn-danger" style={{ fontSize: 12, padding: '2px 8px' }}
                    onClick={handleLoggedInDelete}>삭제</button>
                ) : (
                  <button className="btn btn-danger" style={{ fontSize: 12, padding: '2px 8px' }}
                    onClick={() => setDeleteMode(true)}>삭제</button>
                )}
              </div>
            )}
          </div>
          {deleteMode && (
            <GuestDeleteForm
              comment={reply}
              onSuccess={() => { setDeleteMode(false); onRefresh(); }}
              onCancel={() => setDeleteMode(false)}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── 댓글 아이템 ──────────────────────────────────────────────
function CommentItem({ comment, replies, token, postId, user, onRefresh }) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const guestEmail = getGuestEmail();
  const guestName = getGuestName();
  const isLoggedIn = !!token && !!user;

  // 본인 댓글 여부
  const isOwner = isLoggedIn
    ? (user.role === 'admin' || comment.author_id === user.id)
    : (comment.author_id === null && guestEmail !== '' && comment.author_name === guestName);

  const handleLoggedInDelete = () => {
    setConfirmOpen(true);
  };

  const doLoggedInDelete = async () => {
    const res = await deleteComment(token, comment.id);
    if (res.success) onRefresh();
  };

  return (
    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 16 }}>
      <ConfirmDialog
        isOpen={confirmOpen}
        message="댓글을 삭제할까요?"
        onConfirm={() => { setConfirmOpen(false); doLoggedInDelete(); }}
        onCancel={() => setConfirmOpen(false)}
      />
      {editMode ? (
        <EditForm
          comment={comment}
          token={token}
          onSuccess={() => { setEditMode(false); onRefresh(); }}
          onCancel={() => setEditMode(false)}
        />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-h)' }}>
                {comment.author_name}
              </span>
              {comment.author_id === null && (
                <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-light)',
                  background: 'var(--bg-subtle)', padding: '1px 6px', borderRadius: 99 }}>
                  게스트
                </span>
              )}
              <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-light)' }}>
                {formatDate(comment.created_at)}
              </span>
              <p style={{ marginTop: 6, fontSize: 14, lineHeight: 1.7, color: 'var(--text-h)', whiteSpace: 'pre-wrap' }}>
                {comment.content}
              </p>
            </div>
            {isOwner && !deleteMode && (
              <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '2px 8px' }}
                  onClick={() => setEditMode(true)}>수정</button>
                {isLoggedIn ? (
                  <button className="btn btn-danger" style={{ fontSize: 12, padding: '2px 8px' }}
                    onClick={handleLoggedInDelete}>삭제</button>
                ) : (
                  <button className="btn btn-danger" style={{ fontSize: 12, padding: '2px 8px' }}
                    onClick={() => setDeleteMode(true)}>삭제</button>
                )}
              </div>
            )}
          </div>

          {/* 게스트 삭제 패스워드 입력 */}
          {deleteMode && (
            <GuestDeleteForm
              comment={comment}
              onSuccess={() => { setDeleteMode(false); onRefresh(); }}
              onCancel={() => setDeleteMode(false)}
            />
          )}

          {/* 답글 달기 버튼 (최상위 댓글에만) */}
          {!comment.parent_id && (
            <button className="btn btn-ghost"
              style={{ fontSize: 12, marginTop: 6, padding: '2px 8px' }}
              onClick={() => setShowReplyForm((v) => !v)}>
              {showReplyForm ? '취소' : '답글 달기'}
            </button>
          )}
        </>
      )}

      {/* 답글 작성 폼 */}
      {showReplyForm && (
        <div style={{ marginLeft: 24, marginTop: 8 }}>
          <CommentForm
            token={token}
            postId={postId}
            parentId={comment.id}
            onSuccess={() => { setShowReplyForm(false); onRefresh(); }}
            onCancel={() => setShowReplyForm(false)}
          />
        </div>
      )}

      {/* 답글 목록 */}
      {replies.length > 0 && (
        <div style={{ marginLeft: 24, marginTop: 12 }}>
          {replies.map((reply) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              token={token}
              user={user}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────
export default function CommentSection({ postId, user }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await listComments(postId);
      if (res.success) setComments(res.data);
      setLoading(false);
    };
    load();
  }, [postId]);

  const loadComments = async () => {
    const res = await listComments(postId);
    if (res.success) setComments(res.data);
  };

  // flat list → 계층 구조
  const rootComments = comments.filter((c) => c.parent_id === null);
  const repliesOf = (id) => comments.filter((c) => c.parent_id === id);

  return (
    <div style={{ marginTop: 48 }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-h)', marginBottom: 20 }}>
        댓글 {comments.length > 0 ? `${comments.length}개` : ''}
      </h3>

      {/* 댓글 작성 폼 */}
      <div style={{ marginBottom: 32 }}>
        {!token && !user && (
          <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 8 }}>
            <Link to="/login" style={{ color: 'var(--accent)' }}>로그인</Link>하거나 아래 게스트 정보를 입력해 댓글을 남길 수 있습니다.
          </p>
        )}
        <CommentForm token={token} postId={postId} onSuccess={loadComments} />
      </div>

      {/* 댓글 목록 */}
      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--text-light)' }}>댓글 불러오는 중...</p>
      ) : rootComments.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-light)' }}>첫 댓글을 남겨보세요.</p>
      ) : (
        rootComments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            replies={repliesOf(comment.id)}
            token={token}
            postId={postId}
            user={user}
            onRefresh={loadComments}
          />
        ))
      )}
    </div>
  );
}
