'use client';

import { useEffect, useRef, useState } from 'react';
import StarPrompt from './StarPrompt';

const SHAPES = [['fit', 'Whole picture'], ['fill', 'Zoomed in'], ['original', 'Original']];
const STRONG_DB = 20;
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const fileName = (i) => `clutchcut-${String(i + 1).padStart(2, '0')}.mp4`;

async function errorOf(res) {
  const body = await res.json().catch(() => ({}));
  return body.error || `Something went wrong (HTTP ${res.status}).`;
}

// Clips a link on the website: the server finds the moments, then cuts each clip and streams it
// back. Clips live only in this tab until the person downloads them.
export default function Clipper({ link, onBadLink }) {
  const [count, setCount] = useState(5);
  const [shape, setShape] = useState('fit');
  const [cutShape, setCutShape] = useState('fit'); // the shape the current clips were cut in
  const [stage, setStage] = useState('idle'); // idle | finding | cutting | done
  const [error, setError] = useState('');
  const [clips, setClips] = useState([]); // { start, end, scoreDb, url?, failed? }
  const job = useRef(0);
  const blobs = useRef([]);

  // Blob URLs hold the videos in memory; free them on a new run or when the page goes away.
  const freeBlobs = () => { blobs.current.forEach((u) => URL.revokeObjectURL(u)); blobs.current = []; };
  useEffect(() => freeBlobs, []);

  async function start() {
    const url = link.trim();
    if (!/^https?:\/\//i.test(url) || !URL.canParse(url)) return onBadLink();
    freeBlobs();
    const id = ++job.current;
    const alive = () => job.current === id;
    setError('');
    setClips([]);
    setCutShape(shape);
    setStage('finding');

    const res = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, count }),
    }).catch(() => null);
    if (!alive()) return;
    if (!res?.ok) {
      setError(res ? await errorOf(res) : 'Could not reach the server. Check your connection.');
      return setStage('idle');
    }
    const { clips: plan } = await res.json();
    if (!plan.length) {
      setError('No standout moments found in this video. Try one with more shouting, laughing or action.');
      return setStage('idle');
    }
    setClips(plan);
    setStage('cutting');

    // One at a time, so each finishes well inside the server's time limit.
    for (const [i, clip] of plan.entries()) {
      const q = new URLSearchParams({ url, start: clip.start, end: clip.end, frame: shape });
      const r = await fetch(`/api/clip?${q}`).catch(() => null);
      const update = r?.ok ? { url: URL.createObjectURL(await r.blob()) } : { failed: r ? await errorOf(r) : 'Connection lost.' };
      if (!alive()) return update.url && URL.revokeObjectURL(update.url);
      if (update.url) blobs.current.push(update.url);
      setClips((all) => all.map((c, j) => (j === i ? { ...c, ...update } : c)));
    }
    setStage('done');
  }

  function downloadAll() {
    clips.forEach((c, i) => {
      if (!c.url) return;
      setTimeout(() => Object.assign(document.createElement('a'), { href: c.url, download: fileName(i) }).click(), i * 400);
    });
  }

  const busy = stage === 'finding' || stage === 'cutting';
  const ready = clips.filter((c) => c.url).length;

  return (
    <div className="clipper">
      <div className="opts">
        <div className="opt">
          <span className="opt-label" id="count-label">Clips</span>
          <div className="stepper" role="group" aria-labelledby="count-label">
            <button type="button" onClick={() => setCount((n) => Math.max(1, n - 1))} aria-label="Fewer clips" disabled={busy}>−</button>
            <output aria-live="polite">{count}</output>
            <button type="button" onClick={() => setCount((n) => Math.min(10, n + 1))} aria-label="More clips" disabled={busy}>+</button>
          </div>
        </div>
        <div className="opt">
          <span className="opt-label" id="shape-label">Shape</span>
          <div className="seg" role="radiogroup" aria-labelledby="shape-label">
            {SHAPES.map(([value, label]) => (
              <label key={value}>
                <input type="radio" name="shape" value={value} checked={shape === value} onChange={() => setShape(value)} disabled={busy} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <button type="button" className="btn btn-lime go" onClick={start} disabled={busy}>
        {stage === 'finding' ? 'Finding the loud moments…' : stage === 'cutting' ? `Cutting clip ${Math.min(ready + 1, clips.length)} of ${clips.length}…` : 'Find clips'}
      </button>
      {stage === 'finding' && <p className="note">Listening to the whole video. A long one can take a few minutes; keep this tab open.</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {clips.length > 0 && (
        <section className="results" aria-label="Your clips">
          <div className="results-head">
            <h2>{stage === 'done' ? `${ready} clip${ready === 1 ? '' : 's'} ready` : 'Your clips'}</h2>
            <button type="button" className="btn btn-dark btn-sm" onClick={downloadAll} disabled={!ready}>Download all</button>
          </div>
          {stage === 'done' && <StarPrompt />}
          <div className="clip-grid">
            {clips.map((c, i) => (
              <article key={`${c.start}-${i}`} className="clip">
                <div className={`clip-stage${cutShape === 'original' ? ' wide' : ''}`}>
                  {c.url ? <video src={c.url} controls preload="metadata" />
                    : <p className="clip-wait">{c.failed || 'Cutting…'}</p>}
                  <span className="rank">#{i + 1}</span>
                </div>
                <div className="clip-body">
                  <div className="card-meta"><span>{clock(c.start)} – {clock(c.end)}</span><b>+{c.scoreDb} dB</b></div>
                  <div className="meter"><i style={{ width: `${Math.round(Math.min(1, c.scoreDb / STRONG_DB) * 100)}%` }} /></div>
                  {c.url
                    ? <a className="btn btn-lime btn-sm dl" href={c.url} download={fileName(i)}>Download</a>
                    : <span className="btn btn-dark btn-sm dl" aria-disabled="true">{c.failed ? 'Failed' : 'Cutting…'}</span>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
