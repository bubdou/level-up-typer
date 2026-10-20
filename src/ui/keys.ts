import { useEffect, useRef } from 'react';

/** Keys typed through an input method (Chinese pinyin and others) or non-ASCII characters. */
export function isImeKey(e: KeyboardEvent): boolean {
  return e.isComposing || e.key === 'Process' || e.keyCode === 229 || (e.key.length === 1 && !/^[\x20-\x7e]$/.test(e.key));
}

export const hasCommandModifier = (e: KeyboardEvent) => e.metaKey || e.ctrlKey || e.altKey;

/** Is focus on a control that should get Enter and Space itself? */
export function onControl(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && ['BUTTON', 'SELECT', 'INPUT', 'TEXTAREA', 'A'].includes(t.tagName);
}

/** One window keydown listener for the current screen; always calls the latest handler. */
export function useKeydown(handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => ref.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
}

/** Calls `onLeave` when the window loses focus or the tab is hidden. */
export function useLeave(onLeave: () => void) {
  const ref = useRef(onLeave);
  useEffect(() => {
    ref.current = onLeave;
  });
  useEffect(() => {
    const blur = () => ref.current();
    const vis = () => {
      if (document.visibilityState === 'hidden') ref.current();
    };
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
}
