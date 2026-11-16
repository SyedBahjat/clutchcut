'use strict';
const $ = (id) => document.getElementById(id);

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function setStatus(msg, isError = false) {
  $('status').textContent = msg;
  $('status').classList.toggle('error', isError);
}

// Electron wraps handler errors as "Error invoking remote method 'x': Error: message".
const readable = (e) => String(e.message || e).replace(/^.*?Error: /, '');

function clipCard(clip, index, job) {
  const video = el('video', { src: clip.url, controls: true, preload: 'metadata' });
  const start = el('input', { type: 'number', step: '0.5', min: '0', value: clip.start, ariaLabel: 'Start, in seconds' });
  const end = el('input', { type: 'number', step: '0.5', min: '0', value: clip.end, ariaLabel: 'End, in seconds' });
  const recut = el('button', { type: 'button', className: 'quiet', textContent: 'Re-cut' });
  const reveal = el('button', { type: 'button', className: 'quiet', textContent: 'Show file' });
  const save = el('button', { type: 'button', className: 'quiet', textContent: 'Save as…' });
  const remove = el('button', { type: 'button', className: 'quiet danger', textContent: 'Delete' });

  recut.addEventListener('click', async () => {
    recut.disabled = true;
    setStatus(`Re-cutting clip ${index + 1}…`);
    try {
      const updated = await window.clipper.recut({
        source: job.source, file: clip.file, frame: job.frame, start: start.value, end: end.value,
      });
      video.src = updated.url;
      setStatus(`Clip ${index + 1} re-cut.`);
    } catch (e) {
      setStatus(readable(e), true);
    } finally {
      recut.disabled = false;
    }
  });
  reveal.addEventListener('click', () => window.clipper.reveal(clip.file).catch((e) => setStatus(readable(e), true)));
  save.addEventListener('click', async () => {
    try {
      const saved = await window.clipper.save(clip.file);
      if (saved) setStatus(`Saved to ${saved}`);
    } catch (e) {
      setStatus(readable(e), true);
    }
  });
  remove.addEventListener('click', async () => {
    try {
      if (!(await window.clipper.remove(clip.file))) return;
      card.remove();
      setStatus(`Clip ${index + 1} deleted.`);
    } catch (e) {
      setStatus(readable(e), true);
    }
  });

  const card = el('article', { className: 'clip' }, [

    video,
    el('h2', {}, [`Clip ${index + 1}`, el('small', { textContent: `+${clip.scoreDb} dB` })]),
    el('div', { className: 'trim' }, ['from', start, 'to', end, 's']),
    el('div', { className: 'actions' }, [recut, save]),
    el('div', { className: 'actions' }, [reveal, remove]),
  ]);
  return card;
}

$('pick').addEventListener('click', async () => {
  const file = await window.clipper.pick();
  if (file) $('source').value = file;
});

$('job').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('go').disabled = true;
  $('clips').replaceChildren();
  setStatus('Starting…');
  try {
    const job = await window.clipper.clip({
      source: $('source').value, count: $('count').value, frame: $('frame').value,
    });
    $('clips').replaceChildren(...job.clips.map((clip, i) => clipCard(clip, i, job)));
    setStatus(job.clips.length
      ? `${job.clips.length} clip${job.clips.length === 1 ? '' : 's'} ready. Adjust the times and re-cut if a clip starts late or ends early.`
      : 'No standout moments found in this video.');
  } catch (e) {
    setStatus(readable(e), true);
  } finally {
    $('go').disabled = false;
  }
});

window.clipper.onProgress((msg) => setStatus(msg));
