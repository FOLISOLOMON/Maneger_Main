// Veloura Manager V2 — Keyboard shortcuts hook
// Lightweight utility for global keyboard shortcuts. No dependencies beyond React.

import { useEffect, useCallback } from 'react';

type ShortcutMap = Record<string, () => void>;

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  const handler = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    const mod = e.metaKey || e.ctrlKey;
    const combo = mod ? `${mod ? 'mod+' : ''}${key}` : key;

    const action = shortcuts[combo] || shortcuts[key];
    if (action) {
      e.preventDefault();
      action();
    }
  }, [shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handler]);
}
