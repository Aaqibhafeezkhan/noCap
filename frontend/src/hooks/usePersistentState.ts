import { useEffect, useState } from 'react';

/** useState that survives restarts via localStorage. Storage failures (private
 *  window, disabled storage) silently fall back to the default. */
export function usePersistentState<T>(key: string, fallback: T): [T, (value: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => read(key, fallback));
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Preferences are a convenience; ignore storage errors.
    }
  }, [key, value]);
  return [value, setValue];
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw) as T;
    if (fallback && typeof fallback === 'object' && !Array.isArray(fallback)) return { ...fallback, ...parsed };
    return parsed;
  } catch {
    return fallback;
  }
}
