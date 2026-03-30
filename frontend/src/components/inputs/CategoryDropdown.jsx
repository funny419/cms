/**
 * CategoryDropdown — 카테고리 단일 선택 셀렉트
 * Props:
 *   value: number | null
 *   onChange: (categoryId: number | null) => void
 *   categories: [{ id, name, parent_id }]
 *   placeholder: string
 */
export default function CategoryDropdown({
  value = null,
  onChange,
  categories = [],
  placeholder = '카테고리 선택 (선택사항)',
}) {
  return (
    <select
      className="form-input"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? parseInt(e.target.value, 10) : null)}
    >
      <option value="">{placeholder}</option>
      {categories.map((cat) => (
        <option key={cat.id} value={cat.id}>
          {cat.parent_id ? '  └ ' : ''}{cat.name}
        </option>
      ))}
    </select>
  );
}
