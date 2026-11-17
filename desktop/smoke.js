'use strict';
// End-to-end check of the real app: opens the window, clips a video through the
// UI, saves a screenshot.   npx electron smoke.js <video> <screenshot.png>
const { app } = require('electron');
const fs = require('node:fs');

const [video, shot] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.on('browser-window-created', (_event, win) => {
  win.webContents.on('console-message', (_e, _level, message, line) => console.log('[page]', message, `(line ${line})`));
  win.webContents.once('did-finish-load', async () => {
    const js = (code) => win.webContents.executeJavaScript(code);
    await sleep(1200);
    fs.writeFileSync(shot.replace('.png', '-start.png'), (await win.webContents.capturePage()).toPNG());
    await js(`document.getElementById('source').value = ${JSON.stringify(video)};
              for (let i = 0; i < 7; i++) document.getElementById('less').click(); document.getElementById('job').requestSubmit();`);
    let state;
    for (let i = 0; i < 600; i++) {
      await sleep(500);
      state = await js(`({ clips: document.querySelectorAll('.clip').length,
                           busy: !document.getElementById('working').hidden,
                           status: (document.getElementById('error').hidden ? document.getElementById('stage') : document.getElementById('error')).textContent })`);
      if (!state.busy) break;
    }
    win.show();
    win.focus();
    await sleep(2500); // let the results and video thumbnails paint
    state.resultsVisible = await js(`!document.getElementById('results').hidden`);
    state.videoReady = await js(`document.querySelector('.clip video')?.readyState >= 1`);
    state.buttons = await js(`[...document.querySelectorAll('.clip .actions button')].map((b) => b.textContent).join('|')`);
    win.webContents.invalidate();
    fs.writeFileSync(shot, (await win.webContents.capturePage()).toPNG());
    console.log(JSON.stringify(state));
    app.exit(state.clips > 0 ? 0 : 1);
  });
});

require('./main.js');
