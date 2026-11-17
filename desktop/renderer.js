'use strict';
const $ = (id) => document.getElementById(id);
const MIN_CLIPS = 1;
const MAX_CLIPS = 30;
const STRONG_DB = 20; // a moment this far above the stream's normal level fills the meter

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

// Electron wraps handler errors as "Error invoking remote method 'x': Error: message".
const readable = (e) => String(e.message || e).replace(/^.*?Error: /, '');
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

let toastTimer;
function toast(msg) {
  $('toast').textContent = msg;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
}

function showError(msg) {
  $('error').textContent = msg;
  $('error').hidden = !msg;
}

// 'start' | 'working' | 'results' | 'live'
function show(view) {
  $('start').hidden = view !== 'start';
  $('working').hidden = view !== 'working';
  $('results').hidden = view !== 'results';
  $('live').hidden = view !== 'live';
}

const selectedSensitivity = () => document.querySelector('input[name="sens"]:checked').value;
const selectedFrame = () => document.querySelector('input[name="frame"]:checked').value;
const clipCount = () => Number($('count').textContent);
function setCount(n) {
  $('count').textContent = String(Math.min(MAX_CLIPS, Math.max(MIN_CLIPS, n)));
}

function setProgress(msg) {
  const { text, done, total } = typeof msg === 'string' ? { text: msg } : msg;
  $('stage').textContent = text;
  $('bar').parentElement.classList.toggle('indeterminate', !total);
  $('bar').style.width = total ? `${Math.round((done / total) * 100)}%` : '';
}

function clipCard(clip, index, job, onRemoved) {
  const wide = job.frame === 'original';
  const video = el('video', { src: clip.url, controls: true, preload: 'metadata' });
  const start = el('input', { type: 'number', step: '0.5', min: '0', value: clip.start, ariaLabel: 'Start, in seconds' });
  const end = el('input', { type: 'number', step: '0.5', min: '0', value: clip.end, ariaLabel: 'End, in seconds' });
  const range = el('span', { textContent: `${clock(clip.start)} – ${clock(clip.end)}` });
  const recut = el('button', { type: 'button', className: 'ghost', textContent: 'Re-cut' });
  const save = el('button', { type: 'button', className: 'primary', textContent: 'Save as…' });
  const reveal = el('button', { type: 'button', className: 'ghost', textContent: 'Show', title: 'Show in folder' });
  const remove = el('button', { type: 'button', className: 'ghost danger', textContent: 'Delete' });
  const meter = el('i');
  meter.style.width = `${Math.round(Math.min(1, clip.scoreDb / STRONG_DB) * 100)}%`;

  const guard = (fn) => async () => {
    try { await fn(); } catch (e) { toast(readable(e)); }
  };

  recut.addEventListener('click', async () => {
    recut.disabled = true;
    recut.textContent = 'Cutting…';
    try {
      const updated = await window.clipper.recut({
        source: job.source, file: clip.file, frame: job.frame, start: start.value, end: end.value,
      });
      video.src = updated.url;
      range.textContent = `${clock(updated.start)} – ${clock(updated.end)}`;
      toast(`Clip ${index + 1} re-cut`);
    } catch (e) {
      toast(readable(e));
    } finally {
      recut.disabled = false;
      recut.textContent = 'Re-cut';
    }
  });
  save.addEventListener('click', guard(async () => {
    const saved = await window.clipper.save(clip.file);
    if (saved) toast(`Saved to ${saved}`);
  }));
  reveal.addEventListener('click', guard(() => window.clipper.reveal(clip.file)));
  remove.addEventListener('click', guard(async () => {
    if (!(await window.clipper.remove(clip.file))) return;
    card.remove();
    onRemoved();
  }));

  const stage = el('div', { className: `stage${wide ? ' wide' : ''}` }, [video, el('span', { className: 'rank', textContent: `#${clip.n ?? index + 1}` })]);
  const card = el('article', { className: 'clip' }, [
    stage,
    el('div', { className: 'body' }, [
      el('div', { className: 'meta' }, [range, el('b', { textContent: `+${clip.scoreDb} dB` })]),
      el('div', { className: 'meter', title: 'How far this moment rises above the stream’s normal loudness' }, [meter]),
      el('div', { className: 'actions' }, [save, reveal, remove]),
      job.source ? el('details', { className: 'trim' }, [
        el('summary', { textContent: 'Adjust start and end' }),
        el('div', { className: 'trim-row' }, ['from', start, 'to', end, 's', recut]),
      ]) : '',
    ]),
  ]);
  card.style.animationDelay = `${Math.min(index, 8) * 50}ms`;
  return card;
}

function showResults(job) {
  let left = job.clips.length;
  const title = () => {
    $('results-title').textContent = left ? `${left} clip${left === 1 ? '' : 's'} ready` : 'No clips left';
  };
  $('clips').replaceChildren(...job.clips.map((clip, i) => clipCard(clip, i, job, () => { left -= 1; title(); })));
  title();
  show('results');
}

async function run() {
  showError('');
  show('working');
  setProgress({ text: 'Starting…' });
  $('go').disabled = true;
  try {
    const job = await window.clipper.clip({
      source: $('source').value, count: clipCount(), frame: selectedFrame(), sensitivity: selectedSensitivity(),
    });
    if (job.live) {
      beginLive(job);
    } else if (job.clips.length) {
      showResults(job);
    } else {
      show('start');
      showError('No standout moments found in this video. Try one with more shouting, laughing or action.');
    }
  } catch (e) {
    show('start');
    showError(readable(e));
  } finally {
    $('go').disabled = false;
  }
}

// Live: clips arrive one by one while the stream is still broadcasting.
let liveJob = null;
let liveCount = 0;

function beginLive(job) {
  liveJob = { source: null, frame: job.frame };
  liveCount = 0;
  $('live-clips').replaceChildren();
  $('live').classList.remove('ended');
  $('live-state').textContent = 'LIVE';
  $('live-text').textContent = 'Listening to the stream…';
  $('stop').hidden = false;
  $('stop').disabled = false;
  $('live-again').hidden = true;
  show('live');
}

function onLive(e) {
  if (!liveJob) return;
  if (e.type === 'listening') $('live-text').textContent = 'Listening… the first clip can appear after about a minute.';
  if (e.type === 'moment') $('live-text').textContent = `Moment spotted at ${clock(e.peak)}. Cutting once the reaction is over…`;
  if (e.type === 'clip') {
    liveCount += 1;
    $('live-clips').prepend(clipCard(e.clip, e.clip.n - 1, liveJob, () => {}));
    $('live-text').textContent = `${liveCount} clip${liveCount === 1 ? '' : 's'} so far. Still listening…`;
  }
  if (e.type === 'error') toast(e.message);
  if (e.type === 'ended') {
    $('live').classList.add('ended');
    $('live-state').textContent = e.reason === 'stopped' ? 'STOPPED' : 'STREAM ENDED';
    $('live-text').textContent = `${liveCount} clip${liveCount === 1 ? '' : 's'} saved.`;
    $('stop').hidden = true;
    $('live-again').hidden = false;
  }
}

function useFile(file) {
  const picked = file && window.clipper.pathFor(file);
  if (!picked) return;
  $('source').value = picked;
  showError('');
}

$('job').addEventListener('submit', (event) => { event.preventDefault(); run(); });
$('pick').addEventListener('click', async () => {
  const file = await window.clipper.pick();
  if (file) $('source').value = file;
});
$('less').addEventListener('click', () => setCount(clipCount() - 1));
$('more').addEventListener('click', () => setCount(clipCount() + 1));
$('again').addEventListener('click', () => { show('start'); $('source').select(); });
$('stop').addEventListener('click', async () => {
  $('stop').disabled = true;
  $('live-text').textContent = 'Stopping and finishing the last clip…';
  try { await window.clipper.liveStop(); } catch (e) { toast(readable(e)); $('stop').disabled = false; }
});
$('live-again').addEventListener('click', () => { liveJob = null; show('start'); $('source').select(); });
$('folder').addEventListener('click', () => window.clipper.openFolder());

// Drag a video anywhere onto the window.
let depth = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); depth += 1; $('drop').hidden = false; });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) $('drop').hidden = true; });
window.addEventListener('drop', (e) => {
  e.preventDefault();
  depth = 0;
  $('drop').hidden = true;
  useFile(e.dataTransfer.files[0]);
});

window.clipper.onProgress(setProgress);
window.clipper.onLive(onLive);
// A link sent from the website fills the box; pressing Find clips is still up to the person.
window.clipper.onPrefill((link) => {
  show('start');
  $('source').value = link;
  $('source').focus();
  $('job').classList.remove('flash');
  void $('job').offsetWidth; // restart the animation
  $('job').classList.add('flash');
  toast('Link received. Press Find clips to start.');
});
