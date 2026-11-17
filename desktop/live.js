'use strict';
// Clips a live stream while it is still broadcasting.
//
// One ffmpeg process reads the stream and does two jobs at once: it feeds a loudness
// detector, and it keeps a rolling buffer of the last few minutes of video on disk. When a
// moment stands out, its clip is cut from that buffer as soon as the reaction has played, so
// nothing waits for the stream to end and the full broadcast is never saved.
//
//   node live.js --selftest

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { cut, snap, run, SR, HOP, SHORT, LONG, PRE, POST, MIN_GAP } = require('./engine');

const SEGMENT = 6;     // seconds per buffered piece of video
const KEEP = 600;      // seconds of video kept in the rolling buffer
const WARMUP = 20;     // listen this long first, to learn the stream's normal level
const SETTLE = 8;      // a rising moment is judged after this long at most
const SENSITIVITY = { strict: 10, normal: 7, eager: 4.5 }; // dB above the stream's normal level

const round1 = (v) => Math.round(v * 10) / 10;
const clock = (s) => `${Math.floor(s / 60)}m${String(Math.floor(s % 60)).padStart(2, '0')}s`;

// Turns raw 16-bit audio into one loudness value (dB) per HOP seconds.
function createFramer(onFrame) {
  const n = Math.round(SR * HOP);
  let sum = 0;
  let count = 0;
  let carry = null;
  return (chunk) => {
    const buf = carry ? Buffer.concat([carry, chunk]) : chunk;
    const usable = buf.length - (buf.length % 2);
    carry = usable < buf.length ? buf.subarray(usable) : null;
    for (let o = 0; o < usable; o += 2) {
      const v = buf.readInt16LE(o);
      sum += v * v;
      if (++count === n) {
        onFrame(20 * Math.log10(Math.sqrt(sum / n) + 1)); // +1 avoids log(0)
        sum = 0;
        count = 0;
      }
    }
  };
}

// The same idea as the finished-video finder, run on a trailing window: a moment is the
// last few seconds being much louder than the last minute.
function createDetector(threshold, onMoment) {
  const db = [];
  const shortN = Math.round(SHORT / HOP);
  const longN = Math.round(LONG / HOP);
  let shortSum = 0;
  let longSum = 0;
  let candidate = null;
  let lastAt = -Infinity;

  function push(value) {
    const i = db.length;
    db.push(value);
    shortSum += value - (i >= shortN ? db[i - shortN] : 0);
    longSum += value - (i >= longN ? db[i - longN] : 0);
    const t = i * HOP;
    if (t < WARMUP) return;
    const score = shortSum / shortN - longSum / Math.min(i + 1, longN);
    if (!candidate) {
      if (score >= threshold && t - lastAt >= MIN_GAP) candidate = { from: t, at: t, score };
      return;
    }
    if (score > candidate.score) { candidate.at = t; candidate.score = score; }
    if (score < threshold / 2 || t - candidate.from >= SETTLE) {
      lastAt = candidate.at;
      // the short window trails the sound, so the real moment sits half a window earlier
      onMoment({ peak: Math.max(0, candidate.at - SHORT / 2), scoreDb: round1(candidate.score) });
      candidate = null;
    }
  }
  return { push, db, seconds: () => db.length * HOP };
}

// The list ffmpeg keeps of finished pieces: name,start,end per line.
function readSegments(dir) {
  let text;
  try { text = fs.readFileSync(path.join(dir, 'list.csv'), 'utf8'); } catch { return []; }
  return text.split(/\r?\n/)
    .map((line) => line.split(','))
    .filter((p) => p.length === 3 && p.every(Boolean))
    .map(([name, a, b]) => ({ file: path.join(dir, name), start: Number(a), end: Number(b) }))
    .filter((s) => s.end > s.start);
}

async function streamAddresses(source) {
  // -S res:720 judges size by the shorter side, so vertical phone streams are handled too.
  // Live feeds often keep video and audio apart, giving two addresses (video first).
  const out = await run(source.ytdlp, ['-f', 'bv*+ba/b', '-S', 'res:720', '-g', '--no-playlist', '--', source.url]);
  const urls = out.toString().trim().split(/\r?\n/).filter(Boolean);
  if (!urls.length) throw new Error('Could not find the live stream. Is it still broadcasting?');
  return urls;
}

// True when the link is a stream that is broadcasting right now.
async function isLive(source) {
  const out = await run(source.ytdlp, ['--print', '%(live_status)s', '--skip-download', '--no-playlist', '--no-warnings', '--', source.url]);
  return out.toString().trim().split(/\r?\n/).pop() === 'is_live';
}

// source: { url, ytdlp } for a live link. For tests, { file } is played back in real time as if live.
async function startLive({ ffmpeg, source, outDir, frame, sensitivity = 'normal', onEvent = () => {} }) {
  const threshold = SENSITIVITY[sensitivity];
  if (!threshold) throw new Error(`unknown sensitivity: ${sensitivity}`);

  const urls = source.file ? [source.file] : await streamAddresses(source);
  const inputs = source.file
    ? ['-re', '-i', source.file]
    : urls.flatMap((u) => ['-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5', '-i', u]);
  const audioMap = urls.length > 1 ? '1:a:0' : '0:a:0';
  const videoMap = '0:v:0';

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clutchcut-live-'));
  fs.mkdirSync(outDir, { recursive: true });
  const pending = [];
  let queue = Promise.resolve();
  let made = 0;
  let stopping = false;
  let heardAudio = false;
  let errText = '';

  const detector = createDetector(threshold, (moment) => {
    made += 1;
    const entry = { ...moment, n: made };
    pending.push(entry);
    onEvent({ type: 'moment', n: entry.n, peak: entry.peak, scoreDb: entry.scoreDb });
  });

  async function cutMoment(moment) {
    const segs = readSegments(dir);
    if (!segs.length) throw new Error('No video was buffered for that moment.');
    const { db } = detector;
    const start = Math.max(segs[0].start, snap(db, Math.max(0, moment.peak - PRE)));
    const end = Math.min(segs[segs.length - 1].end, snap(db, moment.peak + POST));
    const chosen = segs.filter((s) => s.end > start && s.start < end);
    if (!chosen.length || end - start < 3) throw new Error('That moment had already left the buffer.');

    const list = path.join(dir, `cut-${moment.n}.txt`);
    const joined = path.join(dir, `cut-${moment.n}.ts`);
    const dest = path.join(outDir, `live_${String(moment.n).padStart(2, '0')}_${clock(moment.peak)}.mp4`);
    fs.writeFileSync(list, chosen.map((s) => `file '${s.file.replace(/'/g, "'\\''")}'`).join('\n'));
    try {
      await run(ffmpeg, ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined]);
      await cut(ffmpeg, joined, start - chosen[0].start, end - chosen[0].start, dest, frame);
    } finally {
      fs.rmSync(list, { force: true });
      fs.rmSync(joined, { force: true });
    }
    return { n: moment.n, file: dest, start, end, peak: moment.peak, scoreDb: moment.scoreDb };
  }

  const enqueue = (moment) => {
    queue = queue
      .then(() => cutMoment(moment))
      .then((clip) => onEvent({ type: 'clip', clip }))
      .catch((e) => onEvent({ type: 'error', message: e.message }));
  };

  // Once a moment's reaction has been buffered, cut it.
  function cutReady() {
    if (!pending.length) return;
    const segs = readSegments(dir);
    const buffered = segs.length ? segs[segs.length - 1].end : 0;
    for (let i = pending.length - 1; i >= 0; i--) {
      if (buffered >= pending[i].peak + POST) enqueue(pending.splice(i, 1)[0]);
    }
  }

  function prune() {
    const horizon = detector.seconds() - KEEP;
    for (const s of readSegments(dir)) if (s.end < horizon) fs.rmSync(s.file, { force: true });
  }

  const onFrame = (value) => {
    if (!detector.db.length) onEvent({ type: 'listening' });
    detector.push(value);
    const whole = detector.db.length;
    if (whole % 10 === 0) cutReady();
    if (whole % 600 === 0) prune();
  };
  const feed = createFramer(onFrame);

  const args = ['-v', 'error', ...inputs,
    '-map', audioMap, '-ac', '1', '-ar', String(SR), '-f', 's16le', 'pipe:1',
    '-map', videoMap, '-map', audioMap, '-c', 'copy', '-f', 'segment', '-segment_time', String(SEGMENT),
    '-segment_format', 'mpegts', '-reset_timestamps', '1',
    '-segment_list', path.join(dir, 'list.csv'), '-segment_list_type', 'csv', path.join(dir, 'seg%06d.ts')];
  const ff = spawn(ffmpeg, args, { windowsHide: true });
  ff.stdout.on('data', (chunk) => { heardAudio = true; feed(chunk); });
  ff.stderr.on('data', (c) => { errText = (errText + c).slice(-1500); });
  ff.stdin.on('error', () => {});

  const done = new Promise((resolve) => {
    ff.on('error', (e) => { errText = `could not start ffmpeg: ${e.message}`; });
    ff.on('close', async (code) => {
      // stream over or stopped: cut whatever is still waiting from what was buffered
      for (const moment of pending.splice(0)) enqueue(moment);
      await queue;
      fs.rmSync(dir, { recursive: true, force: true });
      if (!stopping && !heardAudio) {
        onEvent({ type: 'error', message: `Could not read the stream: ${errText.trim() || `ffmpeg exited with code ${code}`}` });
      }
      onEvent({ type: 'ended', reason: stopping ? 'stopped' : 'stream-ended', clips: made });
      resolve();
    });
  });

  function stop() {
    if (stopping) return done;
    stopping = true;
    try { ff.stdin.write('q'); } catch { /* already closed */ }
    setTimeout(() => ff.kill('SIGKILL'), 5000).unref();
    return done;
  }

  // For quitting the app: end ffmpeg at once and drop the buffer, without waiting to cut anything.
  function kill() {
    stopping = true;
    ff.kill('SIGKILL');
    fs.rmSync(dir, { recursive: true, force: true });
  }

  return { stop, kill, done };
}

function selftest() {
  const assert = require('node:assert');
  const moments = [];
  const det = createDetector(7, (m) => moments.push(m));
  const quiet = 30;
  for (let i = 0; i < 1500; i++) {
    const t = i * HOP;
    det.push(t >= 100 && t < 103 ? quiet + 25 : quiet + ((i * 7) % 3) * 0.3); // one loud moment at 100-103s
  }
  assert.strictEqual(moments.length, 1, JSON.stringify(moments));
  assert(Math.abs(moments[0].peak - 101.5) < 3, JSON.stringify(moments));

  const calm = [];
  const flat = createDetector(7, (m) => calm.push(m));
  for (let i = 0; i < 3000; i++) flat.push(30 + ((i * 7) % 3) * 0.3);
  assert.strictEqual(calm.length, 0, 'steady noise must not count as a moment');

  const seen = [];
  const feed = createFramer((v) => seen.push(v));
  const odd = Buffer.alloc(SR * HOP * 2 * 3 + 1); // three frames plus one stray byte
  feed(odd.subarray(0, 1001));
  feed(odd.subarray(1001));
  assert.strictEqual(seen.length, 3, 'chunk boundaries must not drop or invent frames');
  console.log('live selftest ok');
}

module.exports = { startLive, isLive, SENSITIVITY };

if (require.main === module && process.argv[2] === '--selftest') selftest();
