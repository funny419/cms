import { useState } from 'react';

export default function ShareButtons({ title }) {
  const [copied, setCopied] = useState(false);
  const url = window.location.href;
  const encoded = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title || '');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shares = [
    { label: 'Twitter', href: `https://twitter.com/intent/tweet?url=${encoded}&text=${encodedTitle}` },
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}` },
    { label: 'LinkedIn', href: `https://www.linkedin.com/shareArticle?url=${encoded}&title=${encodedTitle}` },
  ];

  return (
    <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
      <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 10 }}>이 글 공유하기</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {shares.map(({ label, href }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
            style={{ fontSize: 12 }}
          >
            {label}
          </a>
        ))}
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={handleCopy}>
          {copied ? '✓ 복사됨!' : '🔗 링크 복사'}
        </button>
      </div>
    </div>
  );
}
