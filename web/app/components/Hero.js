'use client';

import { useState } from 'react';

// The website cannot process video itself, so the link box hands the link to the desktop
// app through clutchcut://. The app only fills in its own box; nothing starts without a click there.
export default function Hero() {
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');

  function submit(event) {
    event.preventDefault();
    const value = link.trim();
    if (!value) {
      document.getElementById('download')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (!/^https?:\/\//i.test(value) || !URL.canParse(value)) {
      setNote('That does not look like a video link. Paste the full address, starting with https://');
      return;
    }
    setNote('Opening ClutchCut… If nothing happens, download the app below first.');
    window.location.href = `clutchcut://clip?url=${encodeURIComponent(value)}`;
  }

  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="wrap hero-inner">
        <p className="eyebrow">Gameplay clipper for Mac and Windows</p>
        <h1 id="hero-title">
          Hours of gameplay in.
          <br />
          <span className="mark">Clips worth posting</span> out.
        </h1>
        <p className="lede">
          Paste a link or drop a file. ClutchCut finds the loud moments, keeps the setup and the
          reaction, and cuts them into clips. All on your computer.
        </p>

        <form className="link-box" onSubmit={submit}>
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
          <button type="submit" className="btn btn-lime">Clip it</button>
        </form>
        <p className="note" role="status" aria-live="polite">
          {note || 'Opens the free ClutchCut app on your computer.'}
        </p>
      </div>
    </section>
  );
}
