import { createContext, useContext, useEffect, useState } from 'react';

export const SKINS = [
  { id: 'notion', label: 'Notion', color: '#6c47ff', description: '기본 보라 테마' },
  { id: 'forest', label: 'Forest', color: '#2d6a4f', description: '차분한 초록 테마' },
  { id: 'ocean',  label: 'Ocean',  color: '#0369a1', description: '시원한 파랑 테마' },
  { id: 'rose',   label: 'Rose',   color: '#be185d', description: '따뜻한 분홍 테마' },
];

const SkinContext = createContext(null);

export function SkinProvider({ children }) {
  const [skin, setSkinState] = useState('notion');

  const setSkin = (newSkin) => {
    setSkinState(newSkin);
    document.documentElement.setAttribute('data-skin', newSkin);
  };

  // skin 상태 변경 시 data-skin 속성 동기화
  useEffect(() => {
    document.documentElement.setAttribute('data-skin', skin);
  }, [skin]);

  return (
    <SkinContext.Provider value={{ skin, setSkin }}>
      {children}
    </SkinContext.Provider>
  );
}

export const useSkin = () => useContext(SkinContext);
