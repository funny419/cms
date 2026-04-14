import { useEffect } from 'react';

/**
 * useFetch — cancelled 패턴 추상화
 * fetchFn이 null/undefined를 반환하면 fetch를 건너뜁니다 (가드 지원).
 */
export function useFetch(fetchFn, onResult, deps) {
  useEffect(() => {
    let cancelled = false;
    const promise = fetchFn();
    if (!promise) return () => { cancelled = true; };
    promise.then((res) => {
      if (!cancelled) onResult(res);
    });
    return () => { cancelled = true; };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
