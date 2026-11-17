import { REPO_URL } from '../../lib/site';

export default function Nav() {
  return (
    <>
      <p className="announce">
        Free and open source · Clip on the web or in the app · No account, no watermark
      </p>
      <header className="nav">
        <div className="wrap nav-row">
          <a className="logo" href="#top" aria-label="ClutchCut home">
            <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="#1c1916" />
              <rect x="9.5" y="12" width="2.6" height="8" rx="1.3" fill="#ff5a1f" />
              <rect x="14.7" y="7" width="2.6" height="18" rx="1.3" fill="#d9f23c" />
              <rect x="19.9" y="11" width="2.6" height="10" rx="1.3" fill="#ff5a1f" />
            </svg>
            <span>Clutch<b>Cut</b></span>
          </a>
          <nav aria-label="Main navigation" className="nav-links">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#faq">FAQ</a>
            <a href={REPO_URL}>GitHub</a>
          </nav>
          <a className="btn btn-lime btn-sm" href="#download">Download</a>
        </div>
      </header>
    </>
  );
}
