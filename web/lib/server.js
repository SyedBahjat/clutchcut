// Server-only helpers for clipping on the website. The detection and cutting code is the
// desktop app's engine, so the website and the app always pick the same moments.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import engine from '../../desktop/engine.js';

export { engine };
export const ffmpeg = ffmpegPath;
export const MAX_CLIPS = 10;
export const MAX_HOURS = 3; // longer videos would not finish inside one server request
export const MAX_CLIP_SECONDS = 120;
export const FRAMES = ['fit', 'fill', 'original'];

const YTDLP_ASSET = { darwin: 'yt-dlp_macos', linux: 'yt-dlp_linux', win32: 'yt-dlp.exe' };

// yt-dlp has to stay current to keep working with video sites, so it is fetched on first use
// into the temp folder (the only writable place on Vercel) instead of being bundled.
// ponytail: one copy per warm server, never refreshed; a cold start picks up the latest
let ytdlpReady = null;
export function ytdlp() {
  ytdlpReady ??= (async () => {
    const asset = YTDLP_ASSET[process.platform];
    const dest = path.join(os.tmpdir(), `clutchcut-${asset}`);
    if (fs.existsSync(dest)) return dest;
    const res = await fetch(`https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`);
    if (!res.ok) throw new Error(`Could not set up the video fetcher (HTTP ${res.status}).`);
    fs.writeFileSync(`${dest}.part`, Buffer.from(await res.arrayBuffer()), { mode: 0o755 });
    fs.renameSync(`${dest}.part`, dest);
    return dest;
  })().catch((e) => { ytdlpReady = null; throw e; });
  return ytdlpReady;
}

/** @returns {string} the link, if it is a plain http(s) address */
export function cleanLink(value) {
  const link = String(value ?? '').trim();
  if (!/^https?:\/\//i.test(link) || !URL.canParse(link)) throw new Error('That does not look like a video link. Paste the full address, starting with https://');
  return link;
}

/** @returns {Promise<{ live: boolean, duration: number, title: string }>} */
export async function linkInfo(source) {
  const out = await engine.run(source.ytdlp, ['--print', '%(live_status)s\t%(duration)s\t%(title)s',
    '--skip-download', '--no-playlist', '--no-warnings', '--', source.url]);
  const [status, duration, title] = out.toString().trim().split(/\r?\n/).pop().split('\t');
  return { live: status === 'is_live' || status === 'is_upcoming', duration: Number(duration) || 0, title: title || '' };
}

// Turns yt-dlp's long error output into one line a person can act on.
export function readable(e) {
  const msg = String(e?.message || e);
  if (/sign in to confirm|not a bot/i.test(msg)) return 'This site blocked our server. Use the desktop app for this link; it fetches from your own connection.';
  if (/unable to download webpage|HTTP Error 4\d\d/i.test(msg)) return 'Could not open that link. Check that it plays in your browser.';
  if (/unsupported url/i.test(msg)) return 'That site is not supported. Paste a link to the video itself.';
  if (/\b(private video|members[- ]only|age[- ]restricted|log ?in required)\b/i.test(msg)) return 'That video is private, members-only or age-restricted, so it cannot be fetched.';
  return msg.split(/\r?\n/).filter(Boolean).pop()?.replace(/^.*?ERROR:\s*/, '').slice(0, 300) || 'Something went wrong.';
}
