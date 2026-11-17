'use client';

import { useEffect, useState } from 'react';
import { INSTALL_COMMAND, REPO, RELEASES_URL, REPO_URL } from '../../lib/site';

// Direct file links come from the latest GitHub release; until it loads (or if it fails)
// every button goes to the releases page, which always works.
const pick = (assets, test) => assets.find((a) => test(a.name))?.browser_download_url;

export default function Download() {
  const [links, setLinks] = useState({});
  const [os, setOs] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOs(/Win/i.test(navigator.userAgent) ? 'win' : /Mac/i.test(navigator.userAgent) ? 'mac' : '');
    const controller = new AbortController();
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(({ assets = [] }) => setLinks({
        macArm: pick(assets, (n) => n.endsWith('.dmg') && n.includes('arm64')),
        macIntel: pick(assets, (n) => n.endsWith('.dmg') && !n.includes('arm64')),
        win: pick(assets, (n) => n.endsWith('.exe')),
      }))
      .catch(() => {}); // the buttons keep pointing at the releases page
    return () => controller.abort();
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the command is selectable on screen */
    }
  }

  const buttons = [
    ['Mac · Apple silicon', links.macArm, os === 'mac'],
    ['Mac · Intel', links.macIntel, false],
    ['Windows', links.win, os === 'win'],
  ];

  return (
    <section className="section download" id="download" aria-labelledby="download-title">
      <div className="wrap narrow center">
        <h2 id="download-title" className="h2">Get ClutchCut.</h2>
        <p className="lede">Free for Mac and Windows. Open source, no account.</p>

        <div className="dl-buttons">
          {buttons.map(([label, url, recommended]) => (
            <a key={label} className={`btn ${recommended ? 'btn-lime' : 'btn-dark'}`} href={url || RELEASES_URL}>
              Download for {label}
            </a>
          ))}
        </div>

        <div className="install">
          <p>Mac, one line in Terminal (skips the security warning):</p>
          <div className="cmd">
            <code>{INSTALL_COMMAND}</code>
            <button type="button" className="btn btn-dark btn-sm" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
        </div>

        <p className="small">
          Prefer to build it yourself? <a href={REPO_URL}>The source is on GitHub</a>.
        </p>
      </div>
    </section>
  );
}
