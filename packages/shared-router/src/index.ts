import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

type UseUrlPaginationQueryOptions = {
  pageKey?: string;
  keywordKey?: string;
  defaultPage?: number;
};

function parsePage(raw: string | null, fallback: number) {
  const value = Number.parseInt(raw || String(fallback), 10);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return value;
}

export function useUrlPaginationQuery(options: UseUrlPaginationQueryOptions = {}) {
  const { pageKey = 'page', keywordKey = 'keyword', defaultPage = 1 } = options;
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parsePage(searchParams.get(pageKey), defaultPage);
  const keyword = (searchParams.get(keywordKey) || '').trim();

  const updateParams = useCallback(
    (updater: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams);
      updater(next);
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  const setPage = useCallback(
    (nextPage: number) => {
      updateParams((next) => {
        next.set(pageKey, String(Math.max(defaultPage, nextPage)));
      });
    },
    [defaultPage, pageKey, updateParams],
  );

  const setKeyword = useCallback(
    (nextKeyword: string, resetPage = true) => {
      updateParams((next) => {
        const normalized = nextKeyword.trim();
        if (normalized) {
          next.set(keywordKey, normalized);
        } else {
          next.delete(keywordKey);
        }
        if (resetPage) {
          next.set(pageKey, String(defaultPage));
        }
      });
    },
    [defaultPage, keywordKey, pageKey, updateParams],
  );

  const clearKeyword = useCallback(
    (resetPage = true) => {
      updateParams((next) => {
        next.delete(keywordKey);
        if (resetPage) {
          next.set(pageKey, String(defaultPage));
        }
      });
    },
    [defaultPage, keywordKey, pageKey, updateParams],
  );

  return {
    searchParams,
    page,
    keyword,
    setPage,
    setKeyword,
    clearKeyword,
    updateParams,
  };
}
