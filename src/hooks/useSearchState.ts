// Veloura Manager V2 — Persistent search state
// Wraps localStorage-backed recent query history so search feels instant
// across page refreshes and navigation.

import { useState, useCallback } from 'react';

const MAX_RECENT = 10;

function getStorageKey(key: string) {
  return `app_search_recent_${key}`;
}

export function useSearchState(defaultValue = '') {
  const storageKey = getStorageKey('global');

  const [query, setQueryState] = useState(() => {
    try {
      return localStorage.getItem(storageKey) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const [recent, setRecent] = useState<string[]>([]);

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
    if (value && value.trim()) {
      setRecent((prev) => {
        const next = [value.trim(), ...prev.filter((q) => q !== value.trim())];
        const sliced = next.slice(0, MAX_RECENT);
        try {
          localStorage.setItem(storageKey, JSON.stringify(sliced));
        } catch {
          // quota exceeded — ignore
        }
        return sliced;
      });
    }
  }, [storageKey]);

  const clearRecent = useCallback(() => {
    setRecent([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [storageKey]);

  return { query, setQuery, recent, clearRecent };
}
