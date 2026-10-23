import { useRef, useState } from 'react';
import { usePersistentState } from './usePersistentState';

/** The welcome dialog opens by itself once: on the first launch with an empty library.
 *  People who already have tracks are not new, so it is marked seen for them silently. */
export function useOnboarding() {
  const [seen, setSeen] = usePersistentState('nocap.onboarding.seen', false);
  const [open, setOpen] = useState(false);
  const decided = useRef(false);

  function decide(trackCount: number) {
    if (decided.current || seen) return;
    decided.current = true;
    if (trackCount > 0 || new URLSearchParams(window.location.search).get('sample') === '1') setSeen(true);
    else setOpen(true);
  }

  function close() {
    setOpen(false);
    setSeen(true);
  }

  return { open, decide, show: () => setOpen(true), close };
}
