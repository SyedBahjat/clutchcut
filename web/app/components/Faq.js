const QUESTIONS = [
  ['Is it really free?', 'Yes. ClutchCut is open source under the MIT licence. There are no accounts, no limits on clips and no watermark.'],
  ['Does my video get uploaded anywhere?', 'No. Everything runs on your computer. For a link, the app fetches the audio to analyse it and then only the few seconds of each clip you get; the full video is never saved.'],
  ['How does it choose the moments?', 'It measures how loud each moment is compared with the minute around it and picks the biggest jumps. It is not an AI model, which keeps it fast and private, but it means a quiet highlight can be missed. You can always adjust a clip or re-cut it.'],
  ['Can it clip a live stream while it is broadcasting?', 'Yes. Paste the link of a stream that is live and ClutchCut listens to it, keeps the last few minutes of video in a temporary buffer, and cuts a clip about twenty seconds after each loud moment. Nothing waits for the stream to end, and the full broadcast is never saved. It starts from when you press the button, not from the beginning of the stream.'],
  ['Which links work?', 'Most public video links. Private or members-only videos will not work, and sites change over time, so a link that fails today may need an app update.'],
  ['My Mac says the app is damaged or unverified.', 'ClutchCut is not notarized by Apple. The one-line install command below avoids the warning, or run xattr -cr /Applications/ClutchCut.app once after dragging the app to Applications.'],
  ['Windows shows a SmartScreen warning.', 'The Windows installer is not code-signed. Choose More info, then Run anyway.'],
  ['Who is responsible for what I clip and post?', 'You are. Make sure you have the right to download, clip and publish the videos you use.'],
];

export default function Faq() {
  return (
    <section className="section" id="faq" aria-labelledby="faq-title">
      <div className="wrap narrow">
        <p className="eyebrow">FAQ</p>
        <h2 id="faq-title" className="h2">Questions people ask.</h2>
        <div className="faq">
          {QUESTIONS.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
