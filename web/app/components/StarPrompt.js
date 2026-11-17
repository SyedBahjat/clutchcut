'use client';

import { useEffect, useState } from 'react';
import { REPO_URL } from '../../lib/site';

const KEY = 'clutchcut-star-asked';

// Shown once clips are ready. Starring or closing it means it is never shown again.
export default function StarPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try { setShow(!localStorage.getItem(KEY)); } catch { setShow(true); }
  }, []);

  function close() {
    try { localStorage.setItem(KEY, '1'); } catch { /* private mode: it just shows again next time */ }
    setShow(false);
  }

  if (!show) return null;
  return (
    <div className="star" role="status">
      <span className="star-icon" aria-hidden="true">★</span>
      <p><b>Did ClutchCut save you time?</b> A star on GitHub helps other people find it.</p>
      <a className="btn btn-lime btn-sm" href={REPO_URL} target="_blank" rel="noreferrer" onClick={close}>Star on GitHub</a>
      <button type="button" className="star-x" onClick={close} aria-label="Not now">×</button>
    </div>
  );
}
