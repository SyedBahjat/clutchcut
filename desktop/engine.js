'use strict';
// Finds the most exciting moments in a video and cuts them into clips.
// A moment is "exciting" when the audio is much louder than the surrounding
// minute (shouting, laughing, crashes over the stream's normal level).
//
//   node engine.js --selftest
//   node engine.js <video file> [count]     (needs ffmpeg on PATH)

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const SR = 8000;       // audio sample rate used for analysis
const HOP = 0.1;       // seconds per loudness frame
const SHORT = 5;       // excitement = loudness over SHORT seconds...
const LONG = 60;       // ...minus the baseline over LONG seconds
const PRE = 12;        // seconds kept before the peak (the setup)
const POST = 18;       // seconds kept after the peak (the reaction)
const SNAP = 2;        // how far a cut may move to land on a quiet frame
const MIN_GAP = 45;    // minimum seconds between two peaks
const MIN_SCORE = 3;   // dB above baseline needed to count as a moment at all

function loudnessDb(samples) {
  const n = Math.round(SR * HOP);
  const db = new Float32Array(Math.floor(samples.length / n));
  for (let f = 0; f < db.length; f++) {
    let sum = 0;
    for (let i = f * n; i < (f + 1) * n; i++) sum += samples[i] * samples[i];
    db[f] = 20 * Math.log10(Math.sqrt(sum / n) + 1); // +1 avoids log(0)
  }
  return db;
}

// Moving average; reads past either end take the edge value.
function smooth(x, seconds) {
  const n = x.length;
  const k = Math.max(1, Math.floor(seconds / HOP));
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + x[i];
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const lo = i - Math.floor(k / 2);
    const hi = lo + k - 1;
    const a = Math.max(lo, 0);
    const b = Math.min(hi, n - 1);
    out[i] = (prefix[b + 1] - prefix[a] + (a - lo) * x[0] + (hi - b) * x[n - 1]) / k;
  }
  return out;
}

// Up to `count` { frame, score } pairs, best first.
function findPeaks(db, count) {
  const short = smooth(db, SHORT);
  const long = smooth(db, LONG);
  const score = short.map((v, i) => v - long[i]);
  const gap = Math.floor(MIN_GAP / HOP);
  const peaks = [];
  while (peaks.length < count) {
    let best = -1;
    for (let i = 0; i < score.length; i++) {
      if (score[i] >= MIN_SCORE && (best < 0 || score[i] > score[best])) best = i;
    }
    if (best < 0) break;
    peaks.push({ frame: best, score: score[best] });
    score.fill(-Infinity, Math.max(0, best - gap), best + gap);
  }
  return peaks;
}

// Move a cut to the quietest frame within SNAP seconds so it doesn't land mid-word.
// ponytail: quietest-frame heuristic; use word timestamps once transcription is added
function snap(db, t) {
  const i = Math.min(Math.floor(t / HOP), db.length - 1);
  const w = Math.floor(SNAP / HOP);
  let best = Math.max(0, i - w);
  for (let j = best; j <= Math.min(db.length - 1, i + w); j++) if (db[j] < db[best]) best = j;
  return best * HOP;
}

const round1 = (v) => Math.round(v * 10) / 10;

function planClips(db, count) {
  if (!db.length) return [];
  const duration = db.length * HOP;
  return findPeaks(db, count).map(({ frame, score }) => {
    const peak = frame * HOP;
    return {
      peak: round1(peak),
      scoreDb: round1(score),
      start: round1(snap(db, Math.max(0, peak - PRE))),
      end: round1(snap(db, Math.min(duration, peak + POST))),
    };
  });
}

// Runs a program; resolves with its stdout, rejects with a readable message.
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    const out = [];
    let err = '';
    child.stdout.on('data', (c) => out.push(c));
    child.stderr.on('data', (c) => { err = (err + c).slice(-2000); });
    child.on('error', (e) => reject(new Error(`could not start ${path.basename(cmd)}: ${e.message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`${path.basename(cmd)} failed: ${err.trim() || `exit code ${code}`}`));
    });
  });
}

// ponytail: whole audio track held in memory (~58 MB per hour); stream it if 10h+ VODs matter
async function loadAudio(ffmpeg, file) {
  const buf = await run(ffmpeg, ['-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', String(SR), '-f', 's16le', '-']);
  const bytes = buf.length - (buf.length % 2);
  return new Int16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + bytes));
}

// How a clip is framed. 'fit' keeps the whole picture inside a 9:16 frame over a
// blurred copy of itself; 'fill' zooms in and loses the sides; 'original' leaves it alone.
// ponytail: fixed layouts; face-cam aware layout later
const FRAMES = {
  fit: 'split[a][b];[a]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=8,scale=1080:1920[bg];'
    + '[b]scale=1080:1920:force_original_aspect_ratio=decrease:force_divisible_by=2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2',
  fill: 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
  original: null,
};

function cut(ffmpeg, src, start, end, dest, frame) {
  if (!(frame in FRAMES)) throw new Error(`unknown framing: ${frame}`);
  const crop = FRAMES[frame] ? ['-vf', FRAMES[frame]] : [];
  return run(ffmpeg, ['-v', 'error', '-y', '-ss', start.toFixed(2), '-to', end.toFixed(2), '-i', src,
    ...crop, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', dest]);
}

// Downloads from video sites fail now and then (a dropped connection, a throttled request),
// so a step is tried a few times before giving up.
async function withRetries(step, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await step();
    } catch (e) {
      if (attempt >= attempts) throw e;
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
}

// YouTube now offers an audio format (IAMF) that the bundled ffmpeg cannot read, so skip it.
const AUDIO_FORMAT = 'ba[acodec!*=iamf]/b';
const VIDEO_FORMAT = 'bv*+ba[acodec!*=iamf]/b';

// A source is { file } for a video on disk, or { url, ytdlp } for a link. A link's video
// is never saved: its audio is piped straight from the downloader into the analyser (so not
// even a temporary file is written), and then only the few seconds of each clip are fetched.
// (ffmpeg reading a stream address directly is throttled by the host, so yt-dlp does the fetching.)
function pipeAudio(ffmpeg, source) {
  return new Promise((resolve, reject) => {
    const opts = { windowsHide: true };
    const dl = spawn(source.ytdlp, ['-f', AUDIO_FORMAT, '--no-playlist', '--quiet', '--no-warnings', '-o', '-', '--', source.url], opts);
    const ff = spawn(ffmpeg, ['-v', 'error', '-i', 'pipe:0', '-vn', '-ac', '1', '-ar', String(SR), '-f', 's16le', '-'], opts);
    const out = [];
    let dlErr = '';
    let ffErr = '';
    let dlCode = null;
    let ffCode = null;
    const settle = () => {
      if (dlCode === null || ffCode === null) return;
      if (ffCode !== 0) {
        const why = dlCode !== 0 && dlErr.trim() ? ` (the downloader said: ${dlErr.trim().split(/\r?\n/).pop()})` : '';
        return reject(new Error(`ffmpeg failed: ${ffErr.trim() || `exit code ${ffCode}`}${why}`));
      }
      if (dlCode !== 0) return reject(new Error(`yt-dlp failed: ${dlErr.trim() || `exit code ${dlCode}`}`));
      const buf = Buffer.concat(out);
      const bytes = buf.length - (buf.length % 2);
      resolve(new Int16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + bytes)));
    };
    dl.stderr.on('data', (c) => { dlErr = (dlErr + c).slice(-1500); });
    ff.stderr.on('data', (c) => { ffErr = (ffErr + c).slice(-1500); });
    ff.stdout.on('data', (c) => out.push(c));
    dl.stdout.pipe(ff.stdin);
    ff.stdin.on('error', () => {}); // ffmpeg stopped reading early; its own exit explains why
    dl.on('error', (e) => reject(new Error(`could not start yt-dlp: ${e.message}`)));
    ff.on('error', (e) => reject(new Error(`could not start ffmpeg: ${e.message}`)));
    dl.on('close', (code) => { dlCode = code; settle(); });
    ff.on('close', (code) => { ffCode = code; settle(); });
  });
}

// Fetches just [start, end] of a linked video into dir; resolves with the file's path.
async function fetchSection(ffmpeg, source, start, end, dir) {
  const out = await withRetries(() => run(source.ytdlp, ['-f', VIDEO_FORMAT, '-S', 'res:1080', '--merge-output-format', 'mp4', '--no-playlist',
    '--download-sections', `*${start.toFixed(2)}-${end.toFixed(2)}`, '--force-keyframes-at-cuts',
    '--downloader-args', 'ffmpeg_i:-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5',
    '--ffmpeg-location', ffmpeg, '-o', path.join(dir, `.section-${Date.now()}.%(ext)s`),
    '--no-simulate', '--print', 'after_move:filepath', '--', source.url]));
  return out.toString().trim().split(/\r?\n/).pop();
}

// Writes one clip to dest, whichever kind of source it comes from.
async function render({ ffmpeg, source, start, end, dest, frame }) {
  if (source.file) return cut(ffmpeg, source.file, start, end, dest, frame);
  const section = await fetchSection(ffmpeg, source, start, end, path.dirname(dest));
  try {
    await cut(ffmpeg, section, 0, end - start, dest, frame);
  } finally {
    fs.rmSync(section, { force: true });
  }
}

async function clipVideo({ ffmpeg, source, count, frame, outDir, onProgress = () => {} }) {
  onProgress({ text: 'Finding the loud moments…' });
  const samples = source.file ? await loadAudio(ffmpeg, source.file) : await withRetries(() => pipeAudio(ffmpeg, source));
  const clips = planClips(loudnessDb(samples), count);
  for (const [i, clip] of clips.entries()) {
    onProgress({ text: `Cutting clip ${i + 1} of ${clips.length}…`, done: i, total: clips.length });
    clip.file = path.join(outDir, `${String(i + 1).padStart(2, '0')}_${Math.floor(clip.start)}s.mp4`);
    await render({ ffmpeg, source, start: clip.start, end: clip.end, dest: clip.file, frame });
  }
  fs.writeFileSync(path.join(outDir, 'clips.json'), JSON.stringify(clips, null, 2));
  return clips;
}

function selftest() {
  const assert = require('node:assert');
  const audio = new Int16Array(SR * 300);
  let seed = 1;
  const noise = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648 - 0.5) * 600;
  for (let i = 0; i < audio.length; i++) {
    const t = i / SR;
    const gain = t >= 200 && t < 203 ? 40 : t >= 100 && t < 103 ? 15 : t >= 189 && t < 189.2 ? 0 : 1;
    audio[i] = noise() * gain;
  }
  const db = loudnessDb(audio);
  const peaks = findPeaks(db, 5).map((p) => p.frame * HOP);
  assert.strictEqual(peaks.length, 2, `peaks: ${peaks}`); // background noise must not count
  assert(Math.abs(peaks[0] - 201.5) < 3 && Math.abs(peaks[1] - 101.5) < 3, `peaks: ${peaks}`);
  const snapped = snap(db, 188);
  assert(snapped >= 189 && snapped <= 189.2, `snap: ${snapped}`);
  const [clip] = planClips(db, 1);
  assert(clip.start < 200 && clip.end > 203, JSON.stringify(clip));
  assert.deepStrictEqual(planClips(new Float32Array(0), 3), []);
  console.log('selftest ok');
}

module.exports = { clipVideo, render, cut, snap, run, SR, HOP, SHORT, LONG, PRE, POST, MIN_GAP };

if (require.main === module) {
  const [arg, count] = process.argv.slice(2);
  if (arg === '--selftest') selftest();
  else if (!arg) console.error('usage: node engine.js <video file> [count] | --selftest');
  else {
    const outDir = path.resolve('clips');
    fs.mkdirSync(outDir, { recursive: true });
    clipVideo({ ffmpeg: 'ffmpeg', source: { file: arg }, count: Number(count) || 10, frame: 'fit', outDir, onProgress: console.log })
      .then((clips) => console.log(clips.length ? clips : 'no standout moments found'))
      .catch((e) => { console.error(e.message); process.exit(1); });
  }
}
