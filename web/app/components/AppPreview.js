// A drawn picture of the app, not a screenshot. The numbers are illustrative.
const BARS = Array.from({ length: 96 }, (_, i) => {
  const base = 16 + ((i * 53) % 19);
  const peaks = [[18, 34], [47, 92], [72, 52]].reduce((tall, [at, h]) => Math.max(tall, h - Math.abs(i - at) * 11), 0);
  return { h: Math.min(100, base + Math.max(0, peaks)), hot: peaks > 14 };
});

const CARDS = [
  { rank: '#1', db: '+16.6 dB', time: '0:06 – 0:35', art: 'a', strength: 88 },
  { rank: '#2', db: '+12.1 dB', time: '5:25 – 5:59', art: 'b', strength: 64 },
  { rank: '#3', db: '+9.4 dB', time: '10:02 – 10:34', art: 'c', strength: 48 },
];

export default function AppPreview() {
  return (
    <section className="wrap preview" aria-label="ClutchCut app preview">
      <div className="window">
        <div className="window-bar" aria-hidden="true"><i /><i /><i /></div>
        <div className="window-body">
          <div className="mock-input" aria-hidden="true">
            <span>https://… your stream link</span>
            <b>Find clips</b>
          </div>

          <div className="timeline" aria-hidden="true">
            {BARS.map((bar, i) => (
              <i key={i} className={bar.hot ? 'hot' : undefined} style={{ '--h': `${bar.h}%`, '--i': i }} />
            ))}
          </div>
          <p className="timeline-cap" aria-hidden="true">
            <span>3 hours of stream audio</span>
            <span>the loudest moments, picked out</span>
          </p>

          <div className="cards">
            {CARDS.map((card) => (
              <article key={card.rank} className={`card art-${card.art}`}>
                <span className="rank">{card.rank}</span>
                <div className="card-art" aria-hidden="true"><i /><i /></div>
                <div className="card-meta">
                  <span>{card.time}</span>
                  <b>{card.db}</b>
                </div>
                <div className="meter" aria-hidden="true"><i style={{ width: `${card.strength}%` }} /></div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
