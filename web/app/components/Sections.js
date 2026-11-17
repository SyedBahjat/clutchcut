const STEPS = [
  ['01', 'Paste a link or drop a file', 'A three-hour stream is fine. Links need no separate download step: ClutchCut fetches the audio it needs and never saves the whole video.'],
  ['02', 'It listens for the moment', 'Every second is measured against the minute around it. Shouts, laughs and crashes rise above the stream’s normal level; steady background noise does not.'],
  ['03', 'Pick, trim, save', 'Each clip keeps the setup before the peak and the reaction after, with cuts that land in a pause. Adjust the start and end, keep the good ones, delete the rest.'],
];

const FEATURES = [
  { title: 'Vertical, without losing the picture', body: 'Clips fit a 9:16 frame with the whole video kept inside over a soft blurred backdrop. Or zoom in to fill the screen, or keep the original shape.', wide: true, demo: 'frames' },
  { title: 'Cuts that land in a pause', body: 'Start and end points move to the quietest instant nearby, so a clip does not begin or end in the middle of a word.' },
  { title: 'Nothing kept', body: 'No upload, no account, no watermark. On the web, clips are cut on the fly and sent straight to your browser; nothing is stored. In the app, everything stays on your machine.' },
  { title: 'Trim, re-cut, save, delete', body: 'Nudge any clip’s start and end and re-cut it in seconds. Save a copy anywhere, or remove it for good.', wide: true },
  { title: 'Open source, MIT licensed', body: 'Read the code, fork it, change it. Releases are built in public on GitHub.', full: true, demo: 'code' },
];

const ROADMAP = ['Reading the picture, not only the sound', 'Captions', 'Face-cam and gameplay layouts', 'Ranking tuned on clips that performed'];

export function Steps() {
  return (
    <section className="section" id="how" aria-labelledby="how-title">
      <div className="wrap">
        <p className="eyebrow">How it works</p>
        <h2 id="how-title" className="h2">From a long stream to a short list.</h2>
        <ol className="steps">
          {STEPS.map(([num, title, body]) => (
            <li key={num}>
              <b>{num}</b>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Features() {
  return (
    <section className="section" id="features" aria-labelledby="features-title">
      <div className="wrap">
        <p className="eyebrow">What you get</p>
        <h2 id="features-title" className="h2">Built to get to the good part fast.</h2>
        <div className="bento">
          {FEATURES.map(({ title, body, wide, full, demo }) => (
            <article key={title} className={`tile${wide ? ' wide' : ''}${full ? ' full' : ''}`}>
              <h3>{title}</h3>
              <p>{body}</p>
              {demo === 'frames' && (
                <div className="frames" aria-hidden="true">
                  <figure><i className="f-fit" /><figcaption>Whole picture</figcaption></figure>
                  <figure><i className="f-fill" /><figcaption>Zoomed in</figcaption></figure>
                  <figure><i className="f-wide" /><figcaption>Original</figcaption></figure>
                </div>
              )}
              {demo === 'code' && <code className="snippet" aria-hidden="true">git clone github.com/SyedBahjat/clutchcut</code>}
            </article>
          ))}
        </div>

        <div className="roadmap">
          <h3>Being built</h3>
          <ul>
            {ROADMAP.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <p>Today ClutchCut finds moments from loudness alone, so a quiet, brilliant play can be missed. Picture-aware detection is next.</p>
        </div>
      </div>
    </section>
  );
}
