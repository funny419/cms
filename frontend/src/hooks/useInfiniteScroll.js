import { useEffect, useRef, useState } from 'react';

/**
 * 인피니트 스크롤 훅
 * @param {(page: number) => Promise<{success: boolean, data: {items: any[], has_more: boolean}}>} fetchFn
 * @param {any[]} deps - 변경 시 목록 초기화 후 1페이지부터 재시작
 *
 * 구현 방식: resetKey 카운터로 deps 변경을 추적.
 * page와 resetKey를 함께 effect 의존성으로 두어 React Strict Mode 이중 실행에도 안전함.
 * IntersectionObserver가 !loading && hasMore를 보장하므로 fetch effect 내 별도 guard 불필요.
 */
export default function useInfiniteScroll(fetchFn, deps = []) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const sentinelRef = useRef(null);

  // deps 변경 시 초기화 — resetKey를 올려 fetch effect를 재트리거
  useEffect(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    setError('');
    setResetKey((k) => k + 1);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  // fetch effect — (resetKey, page) 조합이 바뀔 때마다 실행
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchFn(page)
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setItems((prev) => page === 1 ? res.data.items : [...prev, ...res.data.items]);
          setHasMore(res.data.has_more);
        } else {
          setError(res.error || '불러오기에 실패했습니다.');
        }
      })
      .catch(() => {
        if (!cancelled) setError('네트워크 오류가 발생했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [resetKey, page]); // eslint-disable-line react-hooks/exhaustive-deps

  // IntersectionObserver — sentinel 감지 시 다음 페이지 (error 있으면 중단)
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMore && !loading && !error) {
        setPage((p) => p + 1);
      }
    }, { threshold: 0.1 });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, error]);

  return { items, loading, hasMore, error, sentinelRef };
}
