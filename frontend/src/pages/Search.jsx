// frontend/src/pages/Search.jsx
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PostList from './PostList';
import CategoryDropdown from '../components/inputs/CategoryDropdown';
import { useCategories } from '../context/CategoryContext';
import { getTags } from '../api/tags';
import { searchUsers } from '../api/users';

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories } = useCategories();

  // URL 파라미터로 초기값 설정 (공유/북마크 지원)
  const [inputQ, setInputQ] = useState(searchParams.get('q') || '');
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [categoryId, setCategoryId] = useState(
    searchParams.get('category') ? parseInt(searchParams.get('category'), 10) : null
  );
  const [selectedTagIds, setSelectedTagIds] = useState(
    searchParams.get('tags')
      ? searchParams.get('tags').split(',').map(Number).filter(Boolean)
      : []
  );
  const [inputAuthor, setInputAuthor] = useState(searchParams.get('author') || '');
  const [author, setAuthor] = useState(searchParams.get('author') || '');
  const [allTags, setAllTags] = useState([]);
  const [showAllTags, setShowAllTags] = useState(false);
  const [authorSuggestions, setAuthorSuggestions] = useState([]);

  // 태그 목록 로드
  useEffect(() => {
    getTags().then((res) => { if (res.success) setAllTags(res.data.items || []); });
  }, []);

  // 키워드 디바운스 300ms
  useEffect(() => {
    const t = setTimeout(() => setQ(inputQ.trim()), 300);
    return () => clearTimeout(t);
  }, [inputQ]);

  // 작성자 디바운스 300ms
  useEffect(() => {
    const t = setTimeout(() => setAuthor(inputAuthor.trim()), 300);
    return () => clearTimeout(t);
  }, [inputAuthor]);

  // 작성자 자동완성
  useEffect(() => {
    const trimmed = inputAuthor.trim();
    const t = setTimeout(() => {
      if (!trimmed) {
        setAuthorSuggestions([]);
        return;
      }
      searchUsers(trimmed).then((res) => {
        if (res.success) setAuthorSuggestions(res.data.items || []);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [inputAuthor]);

  // URL 파라미터 동기화
  useEffect(() => {
    const params = {};
    if (q) params.q = q;
    if (categoryId) params.category = categoryId;
    if (selectedTagIds.length) params.tags = selectedTagIds.join(',');
    if (author) params.author = author;
    setSearchParams(params, { replace: true });
  }, [q, categoryId, selectedTagIds, author, setSearchParams]);

  const toggleTag = (tagId) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const hasFilter = q || author || categoryId || selectedTagIds.length > 0;
  const externalFilters = { q, categoryId, tagIds: selectedTagIds, author };
  const visibleTags = showAllTags ? allTags : allTags.slice(0, 10);

  return (
    <div className="page-content" style={{ maxWidth: 900 }}>
      <h1 className="page-heading" style={{ marginBottom: 20 }}>🔍 검색</h1>

      {/* 필터 영역 */}
      <div style={{
        background: 'var(--bg-subtle)', borderRadius: 12,
        padding: 20, marginBottom: 24,
      }}>
        {/* 키워드 */}
        <div className="form-group" style={{ marginBottom: 14 }}>
          <input
            className="form-input"
            type="text"
            value={inputQ}
            onChange={(e) => setInputQ(e.target.value)}
            placeholder="포스트 검색... (2자 이상)"
            autoFocus
            style={{ fontSize: 15 }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          {/* 작성자 */}
          <div style={{ position: 'relative' }}>
            <label className="form-label">작성자</label>
            <input
              className="form-input"
              value={inputAuthor}
              onChange={(e) => setInputAuthor(e.target.value)}
              onBlur={() => setTimeout(() => setAuthorSuggestions([]), 150)}
              placeholder="username 검색..."
            />
            {authorSuggestions.length > 0 && (
              <ul style={{
                position: 'absolute', zIndex: 100, background: 'var(--bg)',
                border: '1px solid var(--border)', borderRadius: 6, padding: 4,
                margin: 0, listStyle: 'none', width: '100%',
                maxHeight: 160, overflowY: 'auto', top: '100%',
              }}>
                {authorSuggestions.map((u) => (
                  <li key={u.id}
                    onMouseDown={() => {
                      setInputAuthor(u.username);
                      setAuthor(u.username);
                      setAuthorSuggestions([]);
                    }}
                    style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 13 }}>
                    {u.username}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 카테고리 */}
          <div>
            <label className="form-label">카테고리</label>
            <CategoryDropdown
              value={categoryId}
              onChange={setCategoryId}
              categories={categories}
              placeholder="전체 카테고리"
            />
          </div>
        </div>

        {/* 태그 */}
        {allTags.length > 0 && (
          <div>
            <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>태그</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {visibleTags.map((tag) => (
                <span
                  key={tag.id}
                  className="badge"
                  onClick={() => toggleTag(tag.id)}
                  style={{
                    cursor: 'pointer', userSelect: 'none',
                    opacity: selectedTagIds.includes(tag.id) ? 1 : 0.45,
                    outline: selectedTagIds.includes(tag.id)
                      ? '2px solid var(--accent)' : 'none',
                  }}
                >
                  #{tag.name}
                </span>
              ))}
              {allTags.length > 10 && (
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: '2px 8px' }}
                  onClick={() => setShowAllTags((p) => !p)}
                >
                  {showAllTags ? '접기' : `+${allTags.length - 10}개 더`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* 필터 초기화 */}
        {hasFilter && (
          <button
            className="btn btn-ghost"
            style={{ marginTop: 12, fontSize: 13 }}
            onClick={() => {
              setInputQ(''); setQ('');
              setInputAuthor(''); setAuthor('');
              setCategoryId(null); setSelectedTagIds([]);
            }}
          >
            필터 초기화
          </button>
        )}
      </div>

      {/* PostList 재사용 — externalFilters + 하이라이팅 */}
      <PostList externalFilters={externalFilters} highlightQ={q} />
    </div>
  );
}
