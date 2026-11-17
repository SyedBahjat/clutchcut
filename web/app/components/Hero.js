'use client';

import { useState } from 'react';
import Clipper from './Clipper';

// Two ways in: clip right here on the website, or hand the link to the desktop app through
// clutchcut://. The app only fills in its own box; nothing starts there without a click.
export default function Hero() {
  const [mode, setMode] = useState('web');
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');

  const badLink = () => setNote('That does not look like a video link. Paste the full address, starting with https://');

  function openInApp(event) {
    event.preventDefault();
    const value = link.trim();
    if (!value) return document.getElementById('download')?.scrollIntoView({ behavior: 'smooth' });
    if (!/^https?:\/\//i.test(value) || !URL.canParse(value)) return badLink();
    setNote('Opening ClutchCut… If nothing happens, download the app below first.');
    window.location.href = `clutchcut://clip?url=${encodeURIComponent(value)}`;
  }

  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="wrap hero-inner">
        <p className="eyebrow">Gameplay clipper · web, Mac and Windows</p>
        <h1 id="hero-title">
          Hours of gameplay in.
          <br />
          <span className="mark">Clips worth posting</span> out.
        </h1>
        <p className="lede">
          Paste a link. ClutchCut finds the loud moments, keeps the setup and the reaction, and
          cuts them into clips. Right here in your browser, or in the free app.
        </p>

        <div className="modes" role="tablist" aria-label="Where to clip">
          <button type="button" role="tab" aria-selected={mode === 'web'} onClick={() => setMode('web')}>
            <b>Clip on the web</b><span>Nothing to install</span>
          </button>
          <button type="button" role="tab" aria-selected={mode === 'app'} onClick={() => setMode('app')}>
            <b>Use the desktop app</b><span>Live streams, long videos, files</span>
          </button>
        </div>

        <form className="link-box" onSubmit={mode === 'app' ? openInApp : (e) => e.preventDefault()}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            inputMode="url"
            placeholder="Paste a video link"
            value={link}
            onChange={(e) => { setLink(e.target.value); setNote(''); }}
            aria-label="Video link"
            spellCheck={false}
            autoComplete="off"
          />
          {mode === 'app' && <button type="submit" className="btn btn-lime">Open in app</button>}
        </form>
        <p className="note" role="status" aria-live="polite">
          {note || (mode === 'app'
            ? 'Opens the free ClutchCut app on your computer. Not installed? Download it below.'
            : 'Videos up to 3 hours. For live streams or files on your computer, use the app.')}
        </p>

        {mode === 'web' && <Clipper link={link} onBadLink={badLink} />}
      </div>
    </section>
  );
}
