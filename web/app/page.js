// Set NEXT_PUBLIC_RELEASES_URL to the GitHub releases page (…/releases/latest) once a
// build is published; until then the buttons show "coming soon".
const RELEASES_URL = process.env.NEXT_PUBLIC_RELEASES_URL || null;
const DOWNLOADS = [
  { label: 'Mac', url: RELEASES_URL },
  { label: 'Windows', url: RELEASES_URL },
];

// Loudness strip for the hero: a flat stream with one moment that jumps out.
const BARS = Array.from({ length: 64 }, (_, i) => {
  const base = 14 + ((i * 37) % 17);
  const spike = Math.max(0, 80 - Math.abs(i - 41) * 16);
  return { height: Math.min(100, base + spike), inClip: i >= 34 && i <= 46 };
});

const STEPS = [
  ['01', 'Drop in a stream', 'Paste a video link or choose a file. A three-hour session is fine.'],
  ['02', 'It listens', 'ClutchCut measures how loud every moment is against the minute around it. Shouts, laughs and crashes stand out; steady background noise does not.'],
  ['03', 'You get clips', 'Each clip keeps the setup before the moment and the reaction after it, and the cuts land in a pause rather than mid-word.'],
];

function Downloads() {
  return (
    <ul className="downloads">
      {DOWNLOADS.map(({ label, url }) => (
        <li key={label}>
          {url ? (
            <a className="button" href={url}>Download for {label}</a>
          ) : (
            <span className="button is-pending">{label} — coming soon</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <>
      <header className="top">
        <strong className="brand">Clutch<span>Cut</span></strong>
        <nav aria-label="Main navigation">
          <a href="#how">How it works</a>
          <a href="#honest">What it does today</a>
          <a href="#get">Download</a>
        </nav>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-heading">
          <h1 id="hero-heading">
            Three hours in.<br />
            <em>Ten clips</em> out.
          </h1>
          <p className="lede">
            ClutchCut finds the moments worth posting in long gameplay videos and cuts them out for you.
            It runs on your own computer, so your footage is never uploaded.
          </p>
          <Downloads />

          <figure className="strip">
            <div className="bars" aria-hidden="true">
              {BARS.map((bar, i) => (
                <i key={i} className={bar.inClip ? 'in-clip' : undefined} style={{ '--h': `${bar.height}%` }} />
              ))}
            </div>
            <figcaption>
              <span>stream audio</span>
              <span className="tag">clip: 12s of setup, the moment, 18s of reaction</span>
            </figcaption>
          </figure>
        </section>

        <section id="how" className="steps" aria-labelledby="how-heading">
          <h2 id="how-heading">How it works</h2>
          <ol>
            {STEPS.map(([num, title, body]) => (
              <li key={num}>
                <b>{num}</b>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="honest" className="honest" aria-labelledby="honest-heading">
          <h2 id="honest-heading">What it does today</h2>
          <div className="columns">
            <div>
              <h3>In the app now</h3>
              <ul>
                <li>Finds standout moments from the audio</li>
                <li>Vertical clips that keep the whole picture, or zoom in</li>
                <li>Adjust any clip&rsquo;s start and end, then re-cut</li>
                <li>Works from a link or a file on your disk</li>
              </ul>
            </div>
            <div>
              <h3>Being built</h3>
              <ul>
                <li>Reading the picture, not only the sound</li>
                <li>Captions</li>
                <li>Face-cam and gameplay layouts</li>
                <li>Ranking tuned on clips that performed</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="get" className="get" aria-labelledby="get-heading">
          <h2 id="get-heading">Get ClutchCut</h2>
          <Downloads />
        </section>
      </main>

      <footer>
        <p>You are responsible for having the rights to the videos you clip and post.</p>
      </footer>
    </>
  );
}
