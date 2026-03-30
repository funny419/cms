import { useState } from 'react';

/**
 * TagInput — chip 형태 태그 입력
 * Props:
 *   selectedTags: [{ id, name, slug }]
 *   availableTags: [{ id, name, slug }]
 *   onChange: (tags) => void
 */
export default function TagInput({ selectedTags = [], availableTags = [], onChange }) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = availableTags.filter(
    (t) =>
      input &&
      t.name.toLowerCase().includes(input.toLowerCase()) &&
      !selectedTags.find((s) => s.id === t.id)
  );

  const addTag = (tag) => {
    if (!selectedTags.find((t) => t.id === tag.id)) {
      onChange([...selectedTags, tag]);
    }
    setInput('');
    setShowSuggestions(false);
  };

  const removeTag = (tagId) => {
    onChange(selectedTags.filter((t) => t.id !== tagId));
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
        {selectedTags.map((tag) => (
          <span key={tag.id} className="badge"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            #{tag.name}
            <button
              type="button"
              onClick={() => removeTag(tag.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                color: 'inherit', fontSize: 12, padding: 0, lineHeight: 1 }}>
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        className="form-input"
        value={input}
        onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        placeholder="태그 검색..."
        style={{ fontSize: 13 }}
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul style={{ position: 'absolute', zIndex: 100, background: 'var(--bg)',
          border: '1px solid var(--border)', borderRadius: 6, padding: 4,
          margin: 0, listStyle: 'none', width: '100%', maxHeight: 160, overflowY: 'auto' }}>
          {suggestions.map((tag) => (
            <li key={tag.id}
              onMouseDown={() => addTag(tag)}
              style={{ padding: '6px 10px', cursor: 'pointer', borderRadius: 4, fontSize: 13 }}>
              #{tag.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
