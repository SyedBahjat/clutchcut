'use strict';
// End-to-end check of the real app: opens the window, runs a video through the interface,
// saves screenshots.
//   CLUTCHCUT_OUTPUT=<folder> npx electron smoke.js <video file or link> <screenshot.png> [live-seconds]
// For a live link it waits for the first clip (or live-seconds), then presses Stop.
const { app } = require('electron');
const fs = require('node:fs');

const [video, shot, liveSeconds = '300'] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.on('browser-window-created', (_event, win) => {
  win.webContents.on('console-message', (_e, _level, message, line) => console.log('[page]', message, `(line ${line})`));
  win.webContents.once('did-finish-load', async () => {
    const js = (code) => win.webContents.executeJavaScript(code);
    const look = () => js(`({
      working: !document.getElementById('working').hidden,
      live: !document.getElementById('live').hidden,
      results: !document.getElementById('results').hidden,
      clips: document.querySelectorAll('.clip').length,
      text: document.getElementById('live').hidden
        ? (document.getElementById('error').hidden ? document.getElementById('stage') : document.getElementById('error')).textContent
        : document.getElementById('live-text').textContent,
    })`);
    const snap = async (name) => {
      win.show();
      win.focus();
      await sleep(1500);
      fs.writeFileSync(shot.replace('.png', `-${name}.png`), (await win.webContents.capturePage()).toPNG());
    };

    await sleep(1200);
    await js(`document.getElementById('source').value = ${JSON.stringify(video)};
              for (let i = 0; i < 7; i++) document.getElementById('less').click();
              document.querySelector('input[name="sens"][value="eager"]').click();
              document.getElementById('job').requestSubmit();`);

    let state;
    const started = Date.now();
    for (;;) {
      await sleep(1000);
      state = await look();
      if (state.live || state.results || (!state.working && Date.now() - started > 3000)) break;
      if (Date.now() - started > 420000) break;
    }

    if (state.live) {
      console.log('live view reached:', state.text);
      const deadline = Date.now() + Number(liveSeconds) * 1000;
      while (Date.now() < deadline && (await look()).clips < 1) await sleep(2000);
      await snap('live');
      await js(`document.getElementById('stop').click()`);
      for (let i = 0; i < 90 && !(await js(`document.getElementById('live').classList.contains('ended')`)); i++) await sleep(1000);
      state = { ...(await look()), ended: await js(`document.getElementById('live').classList.contains('ended')`) };
      await snap('ended');
    } else {
      await sleep(2500);
      state.buttons = await js(`[...document.querySelectorAll('.clip .actions button')].map((b) => b.textContent).join('|')`);
      await snap('results');
    }
    console.log(JSON.stringify(state));
    app.exit(state.clips > 0 ? 0 : 1);
  });
});

require('./main.js');
